import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { documentError, ownedDocument } from "@/lib/documents"
import { getDb, ObjectId, withTransaction, type DeckDoc } from "@/lib/mongodb"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const doc = await ownedDocument((await ctx.params).id, auth.userId)
  if (!doc || doc.status !== "ready") return documentError("Không tìm thấy tài liệu.", 404)
  const body = await req.json().catch(() => null)
  if (!body || !ObjectId.isValid(body.deckId ?? "") || !Number.isInteger(body.page) || body.page < 1 || body.page > 100000 || typeof body.front !== "string" || typeof body.back !== "string" || !body.front.trim() || !body.back.trim() || body.front.length > 10000 || body.back.length > 20000 || typeof body.requestId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(body.requestId)) return documentError("Điền câu hỏi, đáp án và chọn bộ thẻ.", 400)
  try {
    const result = await withTransaction(async session => {
      const db = await getDb(); const deckId = new ObjectId(body.deckId)
      // Updating the owned deck also serializes repeated submissions for this deck.
      const deck = await db.collection<DeckDoc>("decks").findOneAndUpdate(getOwnedActiveDeckFilter(auth.userId, { _id: deckId }), { $set: { updatedAt: new Date() } }, { session })
      if (!deck) return null
      const existing = await db.collection("flashcards").findOne({ deckId, sourceDocumentId: doc._id, sourceRequestId: body.requestId }, { session })
      if (existing) return existing._id
      const now = new Date()
      const inserted = await db.collection("flashcards").insertOne({ deckId, front: body.front.trim(), back: body.back.trim(), level: 0, fsrsState: 0, createdAt: now, updatedAt: now, sourceDocumentId: doc._id, sourceRequestId: body.requestId,
        fields: { source: `${doc.title} · Trang ${body.page}`, sourcePage: String(body.page), sourceDocumentId: doc._id.toString() },
        note: `Nguồn: ${doc.title} · Trang ${body.page}`,
      }, { session })
      return inserted.insertedId
    })
    return result ? NextResponse.json({ id: result.toString() }) : documentError("Không tìm thấy bộ thẻ của bạn.", 404)
  } catch { return documentError("Chưa tạo được thẻ. Bạn có thể thử lại.") }
}
