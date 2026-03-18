import { NextRequest, NextResponse } from "next/server"
import {
    getDecksCollection,
    getQuestionsCollection,
    getReviewLogsCollection,
    ObjectId,
} from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { normalizeImage, normalizeTags } from "@/lib/normalize"
import { mapStateToQueue, normalizeDeckOptions } from "@/lib/fsrs"
import { State } from "ts-fsrs"

type QuestionChoiceInput = {
    text?: unknown
    isCorrect?: unknown
    image?: unknown
}

type QuestionInput = {
    question?: unknown
    choices?: unknown
    explanation?: unknown
    image?: unknown
    tags?: unknown
    order?: unknown
}



export async function GET(req: NextRequest) {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const deckId = req.nextUrl.searchParams.get("deckId")
    const mode = req.nextUrl.searchParams.get("mode") ?? "all"
    if (!deckId || !ObjectId.isValid(deckId)) {
        return NextResponse.json({ error: "Missing or invalid deckId" }, { status: 400 })
    }

    const deckObjectId = new ObjectId(deckId)
    const [questionsCol, decksCol, reviewLogsCol] = await Promise.all([
        getQuestionsCollection(),
        getDecksCollection(),
        getReviewLogsCollection(),
    ])

    // Verify deck ownership
    const deckDoc = await decksCol.findOne(
        getOwnedActiveDeckFilter(userId, { _id: deckObjectId }),
    )
    if (!deckDoc) {
        return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }
    const now = new Date()

    const query: Record<string, unknown> =
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

    let questions = await questionsCol
        .find(query)
        .sort(sort)
        .toArray()

    if (mode === "due") {
        const deckOptions = normalizeDeckOptions(deckDoc.options ?? null)
        const startOfDay = new Date(now)
        startOfDay.setHours(0, 0, 0, 0)

        const reviewCounts = await reviewLogsCol
            .aggregate([
                { $match: { deckId: deckObjectId, createdAt: { $gte: startOfDay } } },
                { $group: { _id: "$state", count: { $sum: 1 } } },
            ])
            .toArray()

        const countMap = new Map<string, number>(
            reviewCounts.map((row) => [String(row._id), Number(row.count) || 0]),
        )

        let remainingNew = Math.max(0, deckOptions.newPerDay - (countMap.get("new") ?? 0))
        const reviewedReview =
            (countMap.get("review") ?? 0) + (countMap.get("relearning") ?? 0)
        let remainingReview = Math.max(0, deckOptions.reviewPerDay - reviewedReview)

        const filtered: typeof questions = []

        for (const question of questions) {
            const queue = mapStateToQueue(question.fsrsState)
            if (queue === "new") {
                if (remainingNew <= 0) continue
                remainingNew -= 1
                filtered.push(question)
                continue
            }

            if (queue === "review") {
                if (remainingReview <= 0) continue
                remainingReview -= 1
                filtered.push(question)
                continue
            }

            filtered.push(question)
        }

        questions = filtered
    }

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
        const authResult = await requireAuth()
        if (authResult instanceof NextResponse) return authResult
        const { userId } = authResult

        const body = await req.json()

        const deckId = typeof body?.deckId === "string" ? body.deckId : ""
        if (!deckId || !ObjectId.isValid(deckId)) {
            return NextResponse.json(
                { error: "Missing or invalid deckId" },
                { status: 400 },
            )
        }

        // Verify deck ownership
        const decksCol = await getDecksCollection()
        const deckDoc = await decksCol.findOne(
            getOwnedActiveDeckFilter(userId, { _id: new ObjectId(deckId) }),
        )
        if (!deckDoc) {
            return NextResponse.json({ error: "Deck not found" }, { status: 404 })
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
        const docs = (items as QuestionInput[])
            .map((q, index: number) => {
                const question = typeof q?.question === "string" ? q.question.trim() : ""
                const rawChoices = Array.isArray(q?.choices) ? q.choices : []
                const choices = rawChoices
                    .map((c: QuestionChoiceInput) => ({
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
                    fsrsState: State.New,
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
