import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import {
  getReviewLogsCollection,
  getMcqResultsCollection,
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  ObjectId,
} from "@/lib/mongodb"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 })
  }

  const format = req.nextUrl.searchParams.get("format") || "json"

  const _id = new ObjectId(id)
  const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
    getDecksCollection(),
    getFlashcardsCollection(),
    getQuestionsCollection(),
  ])

  const deck = await decksCol.findOne(getOwnedActiveDeckFilter(userId, { _id }))
  if (!deck) {
    return NextResponse.json({ error: "Không tìm thấy deck" }, { status: 404 })
  }

  const [flashcards, questions] = await Promise.all([
    flashcardsCol.find({ deckId: _id }).sort({ order: 1, createdAt: 1 }).toArray(),
    questionsCol.find({ deckId: _id }).sort({ order: 1, createdAt: 1 }).toArray(),
  ])

  if (format === "csv") {
    const header = "front,back,dueAt,note,frontImage,backImage"
    const rows = flashcards.map((c) => {
      const escape = (s: string) => `"${(s || "").replace(/"/g, '""')}"`
      return [
        escape(String(c.front ?? "")),
        escape(String(c.back ?? "")),
        escape(c.dueAt ? new Date(c.dueAt).toISOString() : ""),
        escape(String(c.note ?? "")),
        escape(String(c.frontImage ?? "")),
        escape(String(c.backImage ?? "")),
      ].join(",")
    })

    const csv = [header, ...rows].join("\n")
    const deckName = String(deck.name ?? "deck").replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, "_")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${deckName}.csv"`,
      },
    })
  }

  const logs = await getReviewLogsCollection()
  const results = await getMcqResultsCollection()
  const [reviewLogs, mcqResults] = await Promise.all([
    logs.find({ deckId: _id }).toArray(),
    results.find({ deckId: _id, userId: new ObjectId(userId) }, { projection: { userId: 0 } }).toArray(),
  ])
  const data = {
    format: "flashcard-medicine", version: 1,
    deck: { name: deck.name, description: deck.description ?? "", subject: deck.subject ?? "", options: deck.options ?? null },
    flashcards, questions, reviewLogs,
    mcqResults,
    exportedAt: new Date().toISOString(),
  }

  const deckName = String(deck.name ?? "deck").replace(/[^a-zA-Z0-9_\-\u00C0-\u1EF9]/g, "_")

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${deckName}.json"`,
    },
  })
}
