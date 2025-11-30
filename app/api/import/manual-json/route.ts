// app/api/import/manual-json/route.ts
import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Deck from "@/models/Deck"
import Flashcard from "@/models/Flashcard"
import Question from "@/models/Question"

export const runtime = "nodejs"

// ===== Kiểu dữ liệu ===== //
interface ManualFlashcard {
    front: string
    back: string
}

interface ManualChoice {
    text: string
    isCorrect: boolean
}

interface ManualQuestion {
    question: string
    choices: ManualChoice[]
    explanation?: string
}

interface ManualImportPayload {
    deckName: string
    description?: string
    flashcards?: ManualFlashcard[]
    questions?: ManualQuestion[]
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as ManualImportPayload

        const deckName = body.deckName?.trim()
        if (!deckName) {
            return NextResponse.json(
                { error: "Thiếu deckName trong JSON" },
                { status: 400 },
            )
        }

        const flashcards = Array.isArray(body.flashcards)
            ? body.flashcards
            : []
        const questions = Array.isArray(body.questions)
            ? body.questions
            : []

        if (flashcards.length === 0 && questions.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "JSON không có flashcards hoặc questions. Cần ít nhất 1 trong 2.",
                },
                { status: 400 },
            )
        }

        await connectDB()

        // 1. Tạo deck
        const deck = await Deck.create({
            name: deckName,
            description: body.description?.trim(),
        })

        // 2. Lưu flashcards (nếu có)
        if (flashcards.length > 0) {
            const fcDocs = flashcards
                .map((fc: ManualFlashcard) => ({
                    deckId: deck._id,
                    front: fc.front?.toString().trim(),
                    back: fc.back?.toString().trim(),
                }))
                .filter(
                    (f: { front: string; back: string }) => f.front && f.back,
                )

            if (fcDocs.length) {
                await Flashcard.insertMany(fcDocs)
            }
        }

        // 3. Lưu questions (nếu có)
        if (questions.length > 0) {
            const qDocs = questions
                .map((q: ManualQuestion) => {
                    const question = q.question?.toString().trim()
                    const choices: ManualChoice[] = Array.isArray(q.choices)
                        ? q.choices
                        : []

                    const normalizedChoices = choices
                        .map((c: ManualChoice) => ({
                            text: c.text?.toString().trim(),
                            isCorrect: Boolean(c.isCorrect),
                        }))
                        .filter((c) => c.text)

                    return {
                        deckId: deck._id,
                        question,
                        choices: normalizedChoices,
                        explanation: q.explanation
                            ? q.explanation.toString().trim()
                            : undefined,
                    }
                })
                .filter(
                    (q) =>
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
        console.error("Error in /api/import/manual-json", error)
        return NextResponse.json(
            { error: "Không thể import JSON thủ công" },
            { status: 500 },
        )
    }
}
