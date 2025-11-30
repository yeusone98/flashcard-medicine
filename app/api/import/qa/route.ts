// app/api/import/qa/route.ts
import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { parseQAPairs } from "@/lib/parsers"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
} from "@/lib/mongodb"

export const runtime = "nodejs"

// helper shuffle đơn giản
function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const deckName = formData.get("deckName")?.toString().trim() || ""
    const deckDescription =
      formData.get("deckDescription")?.toString().trim() || ""

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const result = await mammoth.extractRawText({ buffer })
    const text = result.value || ""

    const cards = parseQAPairs(text) // [{ front: question, back: answer }]

    if (!cards.length) {
      return NextResponse.json(
        { error: "Không tìm thấy cặp Q/A nào (Q: / A:)" },
        { status: 400 },
      )
    }

    const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
      getDecksCollection(),
      getFlashcardsCollection(),
      getQuestionsCollection(),
    ])

    const now = new Date()

    // Tạo deck
    const deckInsert = await decksCol.insertOne({
      name: deckName || file.name.replace(/\.docx$/i, ""),
      description: deckDescription || undefined,
      createdAt: now,
      updatedAt: now,
    })
    const deckId = deckInsert.insertedId

    // Lưu flashcards Q/A
    const fcDocs = cards.map((c) => ({
      deckId,
      front: c.front,
      back: c.back,
      level: 0,
      createdAt: now,
      updatedAt: now,
    }))

    if (fcDocs.length) {
      await flashcardsCol.insertMany(fcDocs)
    }

    // Tạo MCQ từ Q/A
    const questionsForMCQ = cards.map((c, idx) => {
      const wrongCandidates = cards
        .filter((_, j) => j !== idx)
        .map((card) => card.back)

      const wrongShuffled = shuffle(wrongCandidates).slice(0, 3)
      const choiceTexts = [...wrongShuffled, c.back]

      const choices = shuffle(
        choiceTexts.map((text) => ({
          text,
          isCorrect: text === c.back,
        })),
      )

      return {
        deckId,
        question: c.front, // câu hỏi = Q
        choices,
        explanation: c.back, // A làm giải thích ngắn
        level: 0,
        createdAt: now,
        updatedAt: now,
      }
    })

    if (questionsForMCQ.length) {
      await questionsCol.insertMany(questionsForMCQ)
    }

    return NextResponse.json({
      deckId: deckId.toString(),
      importedCount: cards.length,
    })
  } catch (error) {
    console.error("Error in /api/import/qa", error)
    return NextResponse.json(
      { error: "Không thể import file Q/A" },
      { status: 500 },
    )
  }
}
