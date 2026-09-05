import { reserveAiQuota } from "@/lib/ai-quota"
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { State } from "ts-fsrs"

import { requireAuth } from "@/lib/auth-helpers"
import { createDeck } from "@/lib/decks"
import {
  withTransaction,
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



export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { deckName, notes } = await req.json()

    if (typeof deckName !== "string" || !deckName.trim() || deckName.length > 200 || typeof notes !== "string" || !notes.trim() || notes.length > 20000) {
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

    const allowedEmails = (process.env.AI_ALLOWED_EMAILS ?? "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean)
    if (allowedEmails.length && !allowedEmails.includes(authResult.session.user?.email?.toLowerCase() ?? "")) {
      return NextResponse.json({ error: "Tài khoản chưa được phép sử dụng AI" }, { status: 403 })
    }
    if (!await reserveAiQuota(userId)) return NextResponse.json({ error: "Đã hết lượt AI hôm nay (5 lượt/tài khoản, 20 lượt toàn website)." }, { status: 429 })
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0, timeout: 60000 })
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 6000,
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

    if (!flashcards.length && !questions.length) return NextResponse.json({ error: "AI không tạo được thẻ hợp lệ" }, { status: 422 })
    return await withTransaction(async session => {
    const now = new Date()
    const deckInsert = await createDeck({
      session,
      userId,
      name: String(deckName).trim(),
      description: "Sinh tự động từ ghi chú (Notion / Markdown)",
      createdAt: now,
      updatedAt: now,
    })
    const deckId = deckInsert.insertedId

    let flashcardCount = 0
    let questionCount = 0
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
        await flashcardsCol.insertMany(docs, { session })
        flashcardCount = docs.length
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
            question.choices.filter((choice) => choice.isCorrect).length === 1,
        )

      if (qDocs.length) {
        await questionsCol.insertMany(qDocs, { session })
        questionCount = qDocs.length
      }
    }

    if (!flashcardCount && !questionCount) throw new Error("AI returned no valid cards")
    return NextResponse.json({
      success: true,
      deckId: deckId.toString(),
      flashcardCount,
      questionCount,
    })
    })
  } catch (error) {
    console.error("Error in /api/import/notes-ai", error)
    return NextResponse.json(
      { error: "Không thể generate từ notes" },
      { status: 500 },
    )
  }
}
