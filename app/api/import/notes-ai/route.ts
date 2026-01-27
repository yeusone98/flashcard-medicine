// app/api/import/notes-ai/route.ts
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import {
    getDecksCollection,
    getFlashcardsCollection,
    getQuestionsCollection,
} from "@/lib/mongodb"

export const runtime = "nodejs"

// ==== KIỂU DỮ LIỆU AI TRẢ VỀ ==== //
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

        const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
            getDecksCollection(),
            getFlashcardsCollection(),
            getQuestionsCollection(),
        ])

        const now = new Date()

        // 1. Tạo deck
        const deckInsert = await decksCol.insertOne({
            name: String(deckName).trim(),
            description: "Sinh tự động từ ghi chú (Notion / Markdown)",
            createdAt: now,
            updatedAt: now,
        })
        const deckId = deckInsert.insertedId

        // 2. Gọi AI
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
- Flashcards: 8–15 thẻ, hỏi các ý quan trọng trong notes (định nghĩa, phân loại, ngưỡng, ưu/nhược điểm...).
- MCQ: 6–12 câu, mỗi câu có 4 lựa chọn, đúng 1 đáp án.
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
        } catch (e) {
            console.error("JSON parse error:", e, content)
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

        // 3. Lưu flashcards
        if (flashcards.length > 0) {
            const docs = flashcards
                .map((fc: AiFlashcard, index: number) => {
                    const front = fc.front ? String(fc.front).trim() : ""
                    const back = fc.back ? String(fc.back).trim() : ""
                    return {
                        deckId,
                        front,
                        back,
                        order: index,
                        level: 0,
                        createdAt: now,
                        updatedAt: now,
                    }
                })
                .filter((d) => d.front && d.back)

            if (docs.length) {
                await flashcardsCol.insertMany(docs)
            }
        }

        // 4. Lưu MCQ
        if (questions.length > 0) {
            const qDocs = questions
                .map((q: AiQuestion, index: number) => {
                    const question = q.question ? String(q.question).trim() : ""
                    const choices: { text: string; isCorrect: boolean }[] =
                        Array.isArray(q.choices)
                            ? q.choices.map((c: AiChoice) => ({
                                text: c.text ? String(c.text).trim() : "",
                                isCorrect: Boolean(c.isCorrect),
                            }))
                            : []

                    const explanation = q.explanation
                        ? String(q.explanation).trim()
                        : undefined

                    return {
                        deckId,
                        question,
                        choices,
                        explanation,
                        order: index,
                        level: 0,
                        createdAt: now,
                        updatedAt: now,
                    }
                })
                .filter(
                    (q) =>
                        q.question &&
                        q.choices.length >= 2 &&
                        q.choices.some((c) => c.isCorrect),
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
