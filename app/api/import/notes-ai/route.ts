// app/api/import/notes-ai/route.ts
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { connectDB } from "@/lib/mongodb"
import Deck from "@/models/Deck"
import Flashcard from "@/models/Flashcard"
import Question from "@/models/Question"

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

        await connectDB()

        // 1. Tạo deck
        const deck = await Deck.create({
            name: String(deckName).trim(),
            description: "Sinh tự động từ ghi chú (Notion / Markdown)",
        })

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
                .map((fc: AiFlashcard) => {
                    const front = fc.front ? String(fc.front).trim() : ""
                    const back = fc.back ? String(fc.back).trim() : ""
                    return {
                        deckId: deck._id,
                        front,
                        back,
                    }
                })
                .filter(
                    (d: { front: string; back: string }) => d.front && d.back,
                )

            if (docs.length) {
                await Flashcard.insertMany(docs)
            }
        }

        // 4. Lưu MCQ
        if (questions.length > 0) {
            const qDocs = questions
                .map((q: AiQuestion) => {
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
                        deckId: deck._id,
                        question,
                        choices,
                        explanation,
                    }
                })
                .filter(
                    (q: {
                        question: string
                        choices: { text: string; isCorrect: boolean }[]
                    }) =>
                        q.question &&
                        q.choices.length >= 2 &&
                        q.choices.some((c) => c.isCorrect),
                )

            if (qDocs.length) {
                await Question.insertMany(qDocs)
            }
        }

        return NextResponse.json({
            success: true,
            deckId: deck._id,
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
