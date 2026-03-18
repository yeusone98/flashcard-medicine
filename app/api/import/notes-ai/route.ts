// app/api/import/notes-ai/route.ts
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getFlashcardsCollection, getQuestionsCollection } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { createDeck } from "@/lib/decks"
import { State } from "ts-fsrs"

export const runtime = "nodejs"

// ==== KIá»‚U Dá»® LIá»†U AI TRáº¢ Vá»€ ==== //
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
                { error: "Thiáº¿u deckName hoáº·c notes" },
                { status: 400 },
            )
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json(
                { error: "Thiáº¿u OPENAI_API_KEY trong mÃ´i trÆ°á»ng" },
                { status: 500 },
            )
        }

        const [flashcardsCol, questionsCol] = await Promise.all([
            getFlashcardsCollection(),
            getQuestionsCollection(),
        ])

        const now = new Date()

        // 1. Táº¡o deck
        const deckInsert = await createDeck({
            userId,
            name: String(deckName).trim(),
            description: "Sinh tá»± Ä‘á»™ng tá»« ghi chÃº (Notion / Markdown)",
            createdAt: now,
            updatedAt: now,
        })
        const deckId = deckInsert.insertedId

        // 2. Gá»i AI
        const completion = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `
Báº¡n lÃ  trá»£ lÃ½ cho sinh viÃªn Y.
Tá»« Ä‘oáº¡n ghi chÃº (notes) tiáº¿ng Viá»‡t, hÃ£y trÃ­ch xuáº¥t:
1) flashcard (front/back),
2) cÃ¢u há»i tráº¯c nghiá»‡m nhiá»u lá»±a chá»n (MCQ).

TRáº¢ Vá»€ JSON DUY NHáº¤T THEO Cáº¤U TRÃšC:

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

YÃŠU Cáº¦U:
- Flashcards: 8â€“15 tháº», há»i cÃ¡c Ã½ quan trá»ng trong notes (Ä‘á»‹nh nghÄ©a, phÃ¢n loáº¡i, ngÆ°á»¡ng, Æ°u/nhÆ°á»£c Ä‘iá»ƒm...).
- MCQ: 6â€“12 cÃ¢u, má»—i cÃ¢u cÃ³ 4 lá»±a chá»n, Ä‘Ãºng 1 Ä‘Ã¡p Ã¡n.
- DÃ¹ng tiáº¿ng Viá»‡t, ngáº¯n gá»n, dá»… Ã´n thi.
- KhÃ´ng thÃªm text ngoÃ i JSON.`,
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
                { error: "AI khÃ´ng tráº£ vá» dá»¯ liá»‡u" },
                { status: 500 },
            )
        }

        let parsed: AiResponse
        try {
            parsed = JSON.parse(content) as AiResponse
        } catch (e) {
            console.error("JSON parse error:", e, content)
            return NextResponse.json(
                { error: "Dá»¯ liá»‡u AI tráº£ vá» khÃ´ng pháº£i JSON há»£p lá»‡" },
                { status: 500 },
            )
        }

        const flashcards: AiFlashcard[] = Array.isArray(parsed.flashcards)
            ? parsed.flashcards
            : []
        const questions: AiQuestion[] = Array.isArray(parsed.questions)
            ? parsed.questions
            : []

        // 3. LÆ°u flashcards
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
                        fsrsState: State.New,
                        createdAt: now,
                        updatedAt: now,
                    }
                })
                .filter((d) => d.front && d.back)

            if (docs.length) {
                await flashcardsCol.insertMany(docs)
            }
        }

        // 4. LÆ°u MCQ
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
                        fsrsState: State.New,
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
            { error: "KhÃ´ng thá»ƒ generate tá»« notes" },
            { status: 500 },
        )
    }
}
