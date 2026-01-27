import { NextRequest, NextResponse } from "next/server"
import { getQuestionsCollection, ObjectId } from "@/lib/mongodb"

function normalizeImage(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value: unknown): string[] | undefined {
    const raw =
        Array.isArray(value)
            ? value
            : typeof value === "string"
                ? value.split(",")
                : []

    const tags = raw
        .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
        .filter((tag) => tag.length > 0)

    if (tags.length === 0) return undefined
    return Array.from(new Set(tags))
}

export async function GET(req: NextRequest) {
    const deckId = req.nextUrl.searchParams.get("deckId")
    const mode = req.nextUrl.searchParams.get("mode") ?? "all"
    if (!deckId || !ObjectId.isValid(deckId)) {
        return NextResponse.json({ error: "Missing or invalid deckId" }, { status: 400 })
    }

    const deckObjectId = new ObjectId(deckId)
    const questionsCol = await getQuestionsCollection()
    const now = new Date()

    const query: any =
        mode === "due"
            ? {
                deckId: deckObjectId,
                $or: [
                    { dueAt: { $exists: false } },
                    { dueAt: null },
                    { dueAt: { $lte: now } },
                ],
            }
            : { deckId: deckObjectId }

    const sort: Record<string, 1 | -1> =
        mode === "due" ? { dueAt: 1 } : { order: 1, createdAt: 1 }

    const questions = await questionsCol
        .find(query)
        .sort(sort)
        .toArray()

    const data = questions.map((q) => ({
        ...q,
        _id: q._id.toString(),
        deckId: q.deckId.toString(),
        flashcardId: q.flashcardId?.toString(),
    }))

    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        const deckId = typeof body?.deckId === "string" ? body.deckId : ""
        if (!deckId || !ObjectId.isValid(deckId)) {
            return NextResponse.json(
                { error: "Missing or invalid deckId" },
                { status: 400 },
            )
        }

        const deckObjectId = new ObjectId(deckId)
        const questionsCol = await getQuestionsCollection()
        const now = new Date()

        const items = Array.isArray(body?.questions)
            ? body.questions
            : [
                {
                    question: body?.question,
                    choices: body?.choices,
                    explanation: body?.explanation,
                    image: body?.image,
                },
            ]

        const baseOrder = await questionsCol.countDocuments({ deckId: deckObjectId })
        const docs = items
            .map((q: any, index: number) => {
                const question = typeof q?.question === "string" ? q.question.trim() : ""
                const rawChoices = Array.isArray(q?.choices) ? q.choices : []
                const choices = rawChoices
                    .map((c: any) => ({
                        text: typeof c?.text === "string" ? c.text.trim() : "",
                        isCorrect: Boolean(c?.isCorrect),
                        image: normalizeImage(c?.image),
                    }))
                    .filter((c: { text: string }) => c.text)

                return {
                    deckId: deckObjectId,
                    question,
                    choices,
                    image: normalizeImage(q?.image),
                    explanation:
                        typeof q?.explanation === "string"
                            ? q.explanation.trim()
                            : undefined,
                    tags: normalizeTags(q?.tags),
                    order: typeof q?.order === "number" ? q.order : baseOrder + index,
                    level: 0,
                    createdAt: now,
                    updatedAt: now,
                }
            })
            .filter(
                (q: { question: string; choices: { isCorrect: boolean }[] }) =>
                    q.question &&
                    q.choices.length >= 2 &&
                    q.choices.some((c) => c.isCorrect),
            )

        if (docs.length === 0) {
            return NextResponse.json(
                { error: "No valid questions to insert" },
                { status: 400 },
            )
        }

        const result = await questionsCol.insertMany(docs)
        const insertedIds = Object.values(result.insertedIds).map((id) =>
            id.toString(),
        )

        return NextResponse.json({
            success: true,
            insertedCount: result.insertedCount,
            ids: insertedIds,
        })
    } catch (error) {
        console.error("Error creating questions", error)
        return NextResponse.json(
            { error: "Failed to create questions" },
            { status: 500 },
        )
    }
}
