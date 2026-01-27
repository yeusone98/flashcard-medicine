// app/api/flashcards/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, ObjectId } from "@/lib/mongodb"
import { applySm2 } from "@/lib/srs"

type SimpleRating = "hard" | "medium" | "easy"

function ratingToGrade(rating: SimpleRating): 3 | 4 | 5 {
    if (rating === "hard") return 3
    if (rating === "medium") return 4
    return 5
}

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await props.params

        if (!ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: "Invalid flashcardId" },
                { status: 400 },
            )
        }

        const body = await req.json().catch(() => ({}))
        const rating = String(body.rating ?? "") as SimpleRating

        if (!["hard", "medium", "easy"].includes(rating)) {
            return NextResponse.json(
                { error: "rating must be 'hard' | 'medium' | 'easy'" },
                { status: 400 },
            )
        }

        const flashcardsCol = await getFlashcardsCollection()
        const _id = new ObjectId(id)

        const card = await flashcardsCol.findOne({ _id })
        if (!card) {
            return NextResponse.json(
                { error: "Flashcard not found" },
                { status: 404 },
            )
        }

        const now = new Date()
        const grade = ratingToGrade(rating)

        const next = applySm2(
            {
                repetitions: card.sm2Repetitions ?? 0,
                interval: card.sm2Interval ?? 0,
                easiness: card.sm2Easiness ?? 2.5,
            },
            grade,
            now,
        )

        const intervalMinutes = next.interval * 24 * 60

        await flashcardsCol.updateOne(
            { _id },
            {
                $set: {
                    lastReviewedAt: now,
                    dueAt: next.dueAt,
                    sm2Repetitions: next.repetitions,
                    sm2Interval: next.interval,
                    sm2Easiness: next.easiness,
                    reviewRating: rating,
                    reviewIntervalMinutes: intervalMinutes,
                    updatedAt: now,
                },
            },
        )

        return NextResponse.json({
            success: true,
            cardId: id,
            next: {
                rating,
                intervalDays: next.interval,
                intervalMinutes,
                easiness: next.easiness,
                dueAt: next.dueAt,
            },
        })
    } catch (err) {
        console.error("Review error", err)
        return NextResponse.json(
            { error: "Failed to update review schedule" },
            { status: 500 },
        )
    }
}
