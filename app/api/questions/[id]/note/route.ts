import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { getDecksCollection, getQuestionsCollection, ObjectId } from "@/lib/mongodb"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth()
    if (auth instanceof NextResponse) return auth
    const { id } = await params
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Mã câu hỏi không hợp lệ" }, { status: 400 })
    const body = await req.json().catch(() => null)
    if (typeof body?.note !== "string" || body.note.length > 5000) {
      return NextResponse.json({ error: "Ghi chú phải là văn bản, tối đa 5.000 ký tự" }, { status: 400 })
    }
    const [questions, decks] = await Promise.all([getQuestionsCollection(), getDecksCollection()])
    const _id = new ObjectId(id)
    const question = await questions.findOne({ _id })
    if (!question || !await decks.findOne(getOwnedActiveDeckFilter(auth.userId, { _id: question.deckId }))) {
      return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 })
    }
    const updated = await questions.updateOne({ _id, deckId: question.deckId }, { $set: { note: body.note, updatedAt: new Date() } })
    if (!updated.matchedCount) return NextResponse.json({ error: "Không tìm thấy câu hỏi" }, { status: 404 })
    return NextResponse.json({ questionId: id, note: body.note })
  } catch (error) {
    console.error("Question note save failed", error)
    return NextResponse.json({ error: "Không lưu được ghi chú. Bạn thử lại nhé." }, { status: 500 })
  }
}
