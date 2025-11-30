// app/api/import/manual-json/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
    getDecksCollection,
    getFlashcardsCollection,
    getQuestionsCollection,
} from "@/lib/mongodb"

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
        const questions = Array.isArray(body.questions) ? body.questions : []

        if (flashcards.length === 0 && questions.length === 0) {
            return NextResponse.json(
                {
                    error:
                        "JSON không có flashcards hoặc questions. Cần ít nhất 1 trong 2.",
                },
                { status: 400 },
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
            name: deckName,
            description: body.description?.trim() || undefined,
            createdAt: now,
            updatedAt: now,
        })
        const deckId = deckInsert.insertedId

        // 2. Lưu flashcards (nếu có)
        if (flashcards.length > 0) {
            const fcDocs = flashcards
                .map((fc: ManualFlashcard) => ({
                    deckId,
                    front: fc.front?.toString().trim(),
                    back: fc.back?.toString().trim(),
                    level: 0,
                    createdAt: now,
                    updatedAt: now,
                }))
                .filter(
                    (f: { front: string; back: string }) => f.front && f.back,
                )

            if (fcDocs.length) {
                await flashcardsCol.insertMany(fcDocs)
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
                        deckId,
                        question,
                        choices: normalizedChoices,
                        explanation: q.explanation
                            ? q.explanation.toString().trim()
                            : undefined,
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
        console.error("Error in /api/import/manual-json", error)
        return NextResponse.json(
            { error: "Không thể import JSON thủ công" },
            { status: 500 },
        )
    }
}
