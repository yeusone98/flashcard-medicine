import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { State } from "ts-fsrs"

import { requireAuth } from "@/lib/auth-helpers"
import { createDeck } from "@/lib/decks"
import {
  getFlashcardsCollection,
  getQuestionsCollection,
} from "@/lib/mongodb"

export const runtime = "nodejs"

type AiFlashcard = {
  front?: unknown
  back?: unknown
}

type AiChoice = {
  text?: unknown
  isCorrect?: unknown
}

type AiQuestion = {
  question?: unknown
  choices?: AiChoice[]
  explanation?: unknown
}

type AiResponse = {
  flashcards?: AiFlashcard[]
  questions?: AiQuestion[]
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { deckName, notes } = await req.json()

    if (!deckName || !notes) {
      return NextResponse.json(
        { error: "Thiếu deckName hoặc notes" },
        { status: 400 },
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY trong môi trường" },
        { status: 500 },
      )
    }

    const [flashcardsCol, questionsCol] = await Promise.all([
      getFlashcardsCollection(),
      getQuestionsCollection(),
    ])

    const now = new Date()
    const deckInsert = await createDeck({
      userId,
      name: String(deckName).trim(),
      description: "Sinh tự động từ ghi chú (Notion / Markdown)",
      createdAt: now,
      updatedAt: now,
    })
    const deckId = deckInsert.insertedId

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Bạn là trợ lý cho sinh viên Y.
Từ đoạn ghi chú (notes) tiếng Việt, hãy trích xuất:
1) flashcard (front/back),
2) câu hỏi trắc nghiệm nhiều lựa chọn (MCQ).

TRẢ VỀ JSON DUY NHẤT THEO CẤU TRÚC:

{
  "flashcards": [
    { "front": string, "back": string }
  ],
  "questions": [
    {
      "question": string,
      "choices": [
        { "text": string, "isCorrect": boolean }
      ],
      "explanation": string
    }
  ]
}

YÊU CẦU:
- Flashcards: 8-15 thẻ, hỏi các ý quan trọng trong notes (định nghĩa, phân loại, ngưỡng, ưu/nhược điểm...).
- MCQ: 6-12 câu, mỗi câu có 4 lựa chọn, đúng 1 đáp án.
- Dùng tiếng Việt, ngắn gọn, dễ ôn thi.
- Không thêm text ngoài JSON.`,
        },
        {
          role: "user",
          content: String(notes),
        },
      ],
    })

    const content = completion.choices[0].message.content
    if (!content) {
      return NextResponse.json(
        { error: "AI không trả về dữ liệu" },
        { status: 500 },
      )
    }

    let parsed: AiResponse
    try {
      parsed = JSON.parse(content) as AiResponse
    } catch (error) {
      console.error("JSON parse error:", error, content)
      return NextResponse.json(
        { error: "Dữ liệu AI trả về không phải JSON hợp lệ" },
        { status: 500 },
      )
    }

    const flashcards: AiFlashcard[] = Array.isArray(parsed.flashcards)
      ? parsed.flashcards
      : []
    const questions: AiQuestion[] = Array.isArray(parsed.questions)
      ? parsed.questions
      : []

    if (flashcards.length > 0) {
      const docs = flashcards
        .map((flashcard, index) => {
          const front = flashcard.front ? String(flashcard.front).trim() : ""
          const back = flashcard.back ? String(flashcard.back).trim() : ""
          return {
            deckId,
            front,
            back,
            order: index,
            level: 0,
            fsrsState: State.New,
            createdAt: now,
            updatedAt: now,
          }
        })
        .filter((doc) => doc.front && doc.back)

      if (docs.length) {
        await flashcardsCol.insertMany(docs)
      }
    }

    if (questions.length > 0) {
      const qDocs = questions
        .map((questionItem, index) => {
          const question = questionItem.question
            ? String(questionItem.question).trim()
            : ""
          const choices: { text: string; isCorrect: boolean }[] =
            Array.isArray(questionItem.choices)
              ? questionItem.choices.map((choice) => ({
                  text: choice.text ? String(choice.text).trim() : "",
                  isCorrect: Boolean(choice.isCorrect),
                }))
              : []

          const explanation = questionItem.explanation
            ? String(questionItem.explanation).trim()
            : undefined

          return {
            deckId,
            question,
            choices,
            explanation,
            order: index,
            level: 0,
            fsrsState: State.New,
            createdAt: now,
            updatedAt: now,
          }
        })
        .filter(
          (question) =>
            question.question &&
            question.choices.length >= 2 &&
            question.choices.some((choice) => choice.isCorrect),
        )

      if (qDocs.length) {
        await questionsCol.insertMany(qDocs)
      }
    }

    return NextResponse.json({
      success: true,
      deckId: deckId.toString(),
      flashcardCount: flashcards.length,
      questionCount: questions.length,
    })
  } catch (error) {
    console.error("Error in /api/import/notes-ai", error)
    return NextResponse.json(
      { error: "Không thể generate từ notes" },
      { status: 500 },
    )
  }
}
