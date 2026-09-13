import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

import { getDb, getPushSubscriptionsCollection, ObjectId } from "@/lib/mongodb"
import { configureWebPush } from "@/lib/web-push"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

type Delivery = { _id: string; dueAt: Date; sentAt: Date }
type DueCard = { _id: ObjectId; deckId: ObjectId; dueAt: Date; reviewRating: string }

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const push = configureWebPush()
  if (!push) return NextResponse.json({ error: "Web Push chưa được cấu hình" }, { status: 503 })

  const db = await getDb()
  const locks = db.collection<{ _id: string; token: string; expiresAt: Date }>("reminder_locks")
  const token = randomUUID()
  const started = Date.now()
  // A lease longer than maxDuration prevents overlapping scheduler calls.
  try {
    const lock = await locks.findOneAndUpdate(
      { _id: "study-reminders", expiresAt: { $lte: new Date() } },
      { $set: { token, expiresAt: new Date(started + 120_000) } },
      { upsert: true, returnDocument: "after" },
    )
    if (!lock) return NextResponse.json({ skipped: "already-running" })
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      return NextResponse.json({ skipped: "already-running" })
    }
    throw error
  }

  try {
    const subscriptions = await getPushSubscriptionsCollection()
    // Rotate through devices rather than starving those after the limit.
    const active = await subscriptions.find({ enabled: true })
      .sort({ lastCheckedAt: 1, _id: 1 }).limit(100).toArray()
    const deliveries = db.collection<Delivery>("reminder_deliveries")
    let checked = 0
    let sent = 0
    let removed = 0
    let failed = 0
    for (const subscription of active) {
      // Leave time for the current push before the scheduler's 30s timeout.
      if (Date.now() - started > 18_000) break
      checked += 1
      await subscriptions.updateOne({ _id: subscription._id }, { $set: { lastCheckedAt: new Date() } })
      const decks = await db.collection("decks").find(
        { userId: subscription.userId, deletedAt: { $exists: false } },
        { projection: { _id: 1 } },
      ).toArray()
      if (!decks.length) continue
      const cards = await db.collection<DueCard>("flashcards").find({
        deckId: { $in: decks.map(deck => deck._id) },
        reviewRating: { $in: ["again", "hard", "good", "easy"] },
        dueAt: { $lte: new Date() },
      }, { projection: { _id: 1, deckId: 1, dueAt: 1 } }).toArray()
      if (!cards.length) continue
      const deliveryId = (card: DueCard) => `${subscription._id}:${card._id}`
      const previous = await deliveries.find({ _id: { $in: cards.map(deliveryId) } }).toArray()
      const sentDates = new Map(previous.map(item => [item._id, item.dueAt.getTime()]))
      const pending = cards.filter(card => sentDates.get(deliveryId(card)) !== card.dueAt.getTime())
      if (!pending.length) continue
      try {
        await push.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify({
            title: "Đến giờ ôn flashcard",
            body: `Bạn có ${pending.length} flashcard đã đánh giá đến giờ ôn.`,
            url: "/decks",
            tag: "study-reminder",
          }),
          { TTL: 300, urgency: "high", timeout: 8_000 },
        )
        // One record per card/device; a new dueAt becomes eligible again.
        await deliveries.bulkWrite(pending.map(card => ({ updateOne: {
          filter: { _id: deliveryId(card) },
          update: { $set: { dueAt: card.dueAt, sentAt: new Date() } },
          upsert: true,
        } })))
        sent += 1
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0
        if (statusCode === 404 || statusCode === 410) {
          await subscriptions.deleteOne({ _id: subscription._id })
          removed += 1
        } else {
          failed += 1
        }
      }
    }
    return NextResponse.json({ checked, sent, removed, failed }, { status: failed ? 503 : 200 })
  } finally {
    await locks.deleteOne({ _id: "study-reminders", token })
  }
}
