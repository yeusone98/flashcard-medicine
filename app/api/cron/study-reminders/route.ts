import { NextRequest, NextResponse } from "next/server"

import { getDb, getPushSubscriptionsCollection, ObjectId } from "@/lib/mongodb"
import { studyDateKey } from "@/lib/study-time"
import { configureWebPush } from "@/lib/web-push"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const push = configureWebPush()
  if (!push) return NextResponse.json({ error: "Web Push chưa được cấu hình" }, { status: 503 })

  const subscriptions = await getPushSubscriptionsCollection()
  const today = studyDateKey()
  const active = await subscriptions.find({ enabled: true, lastSentDate: { $ne: today } }).limit(500).toArray()
  if (!active.length) return NextResponse.json({ checked: 0, sent: 0 })

  const userIds = Array.from(new Map(active.map(item => [item.userId.toString(), item.userId])).values())
  const db = await getDb()
  const decks = await db.collection("decks").find(
    { userId: { $in: userIds }, deletedAt: { $exists: false } },
    { projection: { _id: 1, userId: 1 } },
  ).toArray()
  const ownerByDeck = new Map(decks.map(deck => [deck._id.toString(), deck.userId.toString()]))
  const dueByUser = new Map<string, number>()
  if (decks.length) {
    const dueFilter = {
      deckId: { $in: decks.map(deck => deck._id) },
      reviewRating: { $in: ["again", "hard"] },
      dueAt: { $lte: new Date() },
    }
    const flashcards = await db.collection("flashcards").aggregate<{ _id: ObjectId; count: number }>([
      { $match: dueFilter }, { $group: { _id: "$deckId", count: { $sum: 1 } } },
    ]).toArray()
    for (const row of flashcards) {
      const owner = ownerByDeck.get(row._id.toString())
      if (owner) dueByUser.set(owner, (dueByUser.get(owner) ?? 0) + row.count)
    }
  }

  let sent = 0
  let removed = 0
  for (let offset = 0; offset < active.length; offset += 20) {
    const batch = active.slice(offset, offset + 20)
    await Promise.all(batch.map(async subscription => {
      const due = dueByUser.get(subscription.userId.toString()) ?? 0
      if (!due) return
      try {
        await push.sendNotification(
          { endpoint: subscription.endpoint, keys: subscription.keys },
          JSON.stringify({
            title: "Đến giờ ôn flashcard",
            body: `Bạn có ${due} thẻ Lại hoặc Khó đang chờ ôn.`,
            url: "/decks",
            tag: `study-reminder-${today}`,
          }),
        )
        sent += 1
        await subscriptions.updateOne({ _id: subscription._id }, { $set: { lastSentDate: today, updatedAt: new Date() } })
      } catch (error) {
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0
        if (statusCode === 404 || statusCode === 410) {
          await subscriptions.deleteOne({ _id: subscription._id })
          removed += 1
        }
      }
    }))
  }

  return NextResponse.json({ checked: active.length, dueUsers: dueByUser.size, sent, removed })
}
