import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { getDecksCollection, getFlashcardsCollection, ObjectId, withTransaction } from "@/lib/mongodb"
import { normalizeDeckOptions } from "@/lib/fsrs"
import { ratings, saveReview, type ReviewRating } from "@/lib/reviews"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  const body = await req.json().catch(() => null)
  const rating = body?.rating ?? (typeof body?.isCorrect === "boolean" ? (body.isCorrect ? "good" : "again") : "")
  if (!ObjectId.isValid(id) || !ratings.includes(rating as ReviewRating) || typeof body?.requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId)) {
    return NextResponse.json({ error: "Dữ liệu ôn tập không hợp lệ" }, { status: 400 })
  }
  try {
    const next = await withTransaction(async session => {
      const items = await getFlashcardsCollection()
      const item = await items.findOne({ _id: new ObjectId(id) }, { session })
      if (!item) return null
      const decks = await getDecksCollection()
      const deck = await decks.findOne(getOwnedActiveDeckFilter(auth.userId, { _id: item.deckId }), { session })
      if (!deck) return null
      return saveReview({ itemType: "flashcard", item, rating, requestId: body.requestId, options: normalizeDeckOptions(deck.options), session })
    })
    if (!next) return NextResponse.json({ error: "Không tìm thấy thẻ" }, { status: 404 })
    return NextResponse.json({ success: true, next })
  } catch (error) {
    console.error("Review save failed", error)
    return NextResponse.json({ error: "Chưa lưu được lịch ôn. Vui lòng thử lại." }, { status: 500 })
  }
}
