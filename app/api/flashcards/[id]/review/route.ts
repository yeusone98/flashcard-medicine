import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { getDb, getDecksCollection, getFlashcardsCollection, ObjectId, withTransaction } from "@/lib/mongodb"
import { normalizeDeckOptions } from "@/lib/fsrs"
import { createServerTiming } from "@/lib/server-timing"
import { ratings, saveReview, type ReviewRating } from "@/lib/reviews"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const timing = createServerTiming()
  const auth = await timing.measure("auth", requireAuth)
  if (auth instanceof NextResponse) return timing.finish(auth)
  const { id } = await params
  const body = await req.json().catch(() => null)
  const rating = body?.rating ?? (typeof body?.isCorrect === "boolean" ? (body.isCorrect ? "good" : "again") : "")
  if (!ObjectId.isValid(id) || !ratings.includes(rating as ReviewRating) || typeof body?.requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId)) {
    return timing.finish(NextResponse.json({ error: "Dữ liệu ôn tập không hợp lệ" }, { status: 400 }))
  }
  try {
    await timing.measure("db_init", getDb)
    const next = await timing.measure("transaction", () => withTransaction(async session => {
      const items = await getFlashcardsCollection()
      const item = await timing.measure("read_card", () => items.findOne({ _id: new ObjectId(id) }, { session }))
      if (!item) return null
      const decks = await getDecksCollection()
      const deck = await timing.measure("read_deck", () => decks.findOne(getOwnedActiveDeckFilter(auth.userId, { _id: item.deckId }), { session, projection: { options: 1 } }))
      if (!deck) return null
      return timing.measure("save_review", () => saveReview({ itemType: "flashcard", item, rating, requestId: body.requestId, options: normalizeDeckOptions(deck.options), session }))
    }))
    if (!next) return timing.finish(NextResponse.json({ error: "Không tìm thấy thẻ" }, { status: 404 }))
    return timing.finish(NextResponse.json({ success: true, next }))
  } catch (error) {
    console.error("Review save failed", error)
    return timing.finish(NextResponse.json({ error: "Chưa lưu được lịch ôn. Vui lòng thử lại." }, { status: 500 }))
  }
}
