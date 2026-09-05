import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { getDecksCollection, getMcqResultsCollection, getQuestionsCollection, ObjectId, withTransaction } from "@/lib/mongodb"
import { normalizeDeckOptions } from "@/lib/fsrs"
import { saveReview } from "@/lib/reviews"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const id = req.nextUrl.searchParams.get("deckId") ?? ""
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "deckId không hợp lệ" }, { status: 400 })
  const decks = await getDecksCollection()
  if (!await decks.findOne(getOwnedActiveDeckFilter(auth.userId, { _id: new ObjectId(id) }))) return NextResponse.json({ error: "Không tìm thấy deck" }, { status: 404 })
  const results = await getMcqResultsCollection()
  const result = await results.findOne({ userId: new ObjectId(auth.userId), deckId: new ObjectId(id) }, { sort: { updatedAt: -1 } })
  return NextResponse.json({ result })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (!ObjectId.isValid(body?.deckId ?? "") || typeof body?.attemptId !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(body.attemptId) || !Array.isArray(body.answers) || !body.answers.length || body.answers.length > 1000) {
    return NextResponse.json({ error: "Bài làm không hợp lệ (tối đa 1000 câu/lần)." }, { status: 400 })
  }
  const answers = body.answers as { questionId?: string; selectedIndex?: number | null }[]
  if (answers.some(a => !a || typeof a.questionId !== "string" || !ObjectId.isValid(a.questionId) || (a.selectedIndex !== null && (!Number.isInteger(a.selectedIndex) || a.selectedIndex! < 0))) || new Set(answers.map(a => a.questionId)).size !== answers.length) {
    return NextResponse.json({ error: "Đáp án không hợp lệ" }, { status: 400 })
  }
  try {
    const result = await withTransaction(async session => {
      const deckId = new ObjectId(body.deckId)
      const userId = new ObjectId(auth.userId)
      const decks = await getDecksCollection()
      const deck = await decks.findOne(getOwnedActiveDeckFilter(auth.userId, { _id: deckId }), { session })
      if (!deck) throw new Error("INVALID_DECK")
      const results = await getMcqResultsCollection()
      const existing = await results.findOne({ userId, deckId, attemptId: body.attemptId }, { session })
      if (existing) return existing
      const questions = await getQuestionsCollection()
      const docs = await questions.find({ deckId, _id: { $in: answers.map(a => new ObjectId(a.questionId)) } }, { session }).toArray()
      if (docs.length !== answers.length) throw new Error("INVALID_ANSWERS")
      const byId = new Map(docs.map(q => [q._id.toString(), q]))
      const normalized = []
      for (const answer of answers) {
        const q = byId.get(answer.questionId!)!
        if (answer.selectedIndex !== null && answer.selectedIndex! >= q.choices.length) throw new Error("INVALID_ANSWERS")
        const isCorrect = answer.selectedIndex !== null && q.choices[answer.selectedIndex!].isCorrect
        normalized.push({ questionId: q._id.toString(), selectedIndex: answer.selectedIndex ?? null, isCorrect })
        // An unanswered question has not been reviewed.
        if (answer.selectedIndex !== null) await saveReview({ itemType: "question", item: q, rating: isCorrect ? "good" : "again", requestId: body.attemptId, options: normalizeDeckOptions(deck.options), session })
      }
      const now = new Date()
      const correctCount = normalized.filter(a => a.isCorrect).length
      const doc = { userId, deckId, attemptId: body.attemptId as string, totalQuestions: normalized.length, correctCount, percent: Math.round(correctCount / normalized.length * 100), score10: correctCount / normalized.length * 10, answers: normalized, createdAt: now, updatedAt: now }
      await results.insertOne(doc, { session })
      return doc
    })
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    // An all-unanswered submission can race at the unique attempt index without
    // touching a question. Return the already committed result on retry.
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const results = await getMcqResultsCollection()
      const existing = await results.findOne({ userId: new ObjectId(auth.userId), deckId: new ObjectId(body.deckId), attemptId: body.attemptId })
      if (existing) return NextResponse.json({ ok: true, result: existing })
    }
    console.error("Quiz save failed", error)
    const invalid = error instanceof Error && error.message.startsWith("INVALID_")
    return NextResponse.json({ error: invalid ? "Bộ câu hỏi đã thay đổi hoặc không còn truy cập được. Vui lòng tải lại." : "Chưa lưu được bài làm. Vui lòng thử lại." }, { status: invalid ? 400 : 500 })
  }
}
