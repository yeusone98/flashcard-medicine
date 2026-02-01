// app/api/import/cloze/route.ts
import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { parseClozeFlashcards } from "@/lib/parsers"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
} from "@/lib/mongodb"
import { getDefaultDeckOptions } from "@/lib/fsrs"
import { State } from "ts-fsrs"

export const runtime = "nodejs" // để dùng Buffer/mammoth

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

    const cards = parseClozeFlashcards(text) // [{ front, back }]

    if (!cards.length) {
      return NextResponse.json(
        { error: "Không tìm thấy flashcard Cloze nào ({{}})" },
        { status: 400 },
      )
    }

    // Lấy collection
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
      options: getDefaultDeckOptions(),
      createdAt: now,
      updatedAt: now,
    })

    const deckId = deckInsert.insertedId

    // Lưu flashcard
    const fcDocs = cards.map((c, index) => ({
      deckId,
      front: c.front,
      back: c.back,
      order: index,
      level: 0,
      fsrsState: State.New,
      createdAt: now,
      updatedAt: now,
    }))

    if (fcDocs.length) {
      await flashcardsCol.insertMany(fcDocs)
    }

    const clozeToPrompt = (value: string) =>
      value.replace(/\{\{c\d+::([\s\S]+?)(?:::([\s\S]+?))?\}\}/gi, "___")

    // Tạo câu hỏi trắc nghiệm từ các card
    const questionsForMCQ = cards.map((c, idx) => {
      // pick wrong answers from other cloze cards
      const wrongCandidates = cards
        .filter((_, j) => j !== idx)
        .map((card) => card.answer)
        .filter(Boolean)

      const wrongShuffled = shuffle(wrongCandidates).slice(0, 3)
      const correctAnswer = c.answer || c.back
      const choiceTexts = [...wrongShuffled, correctAnswer]

      const choices = shuffle(
        choiceTexts.map((text) => ({
          text,
          isCorrect: text === correctAnswer,
        })),
      )

      return {
        deckId,
        question: clozeToPrompt(c.front),
        choices,
        explanation: c.answer || c.back,
        order: idx,
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
    console.error("Error in /api/import/cloze", error)
    return NextResponse.json(
      { error: "Không thể import file Cloze" },
      { status: 500 },
    )
  }
}
