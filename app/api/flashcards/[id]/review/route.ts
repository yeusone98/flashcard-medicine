// app/api/flashcards/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
    getFlashcardsCollection,
    ObjectId,
} from "@/lib/mongodb"
import { applySm2, Sm2Grade } from "@/lib/srs"

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await props.params
        if (!ObjectId.isValid(id)) {
            return NextResponse.json(
                { error: "flashcardId không hợp lệ" },
                { status: 400 },
            )
        }

        const body = await req.json().catch(() => ({}))
        const grade = Number(body.grade) as Sm2Grade

        if (Number.isNaN(grade) || grade < 0 || grade > 5) {
            return NextResponse.json(
                { error: "grade phải trong khoảng 0–5" },
                { status: 400 },
            )
        }

        const flashcardsCol = await getFlashcardsCollection()
        const _id = new ObjectId(id)

        const card = await flashcardsCol.findOne({ _id })
        if (!card) {
            return NextResponse.json(
                { error: "Flashcard không tồn tại" },
                { status: 404 },
            )
        }

        const now = new Date()

        const next = applySm2(
            {
                repetitions: card.sm2Repetitions ?? 0,
                interval: card.sm2Interval ?? 0,
                easiness: card.sm2Easiness ?? 2.5,
                dueAt: card.dueAt ?? now,
            },
            grade,
            now,
        )

        await flashcardsCol.updateOne(
            { _id },
            {
                $set: {
                    sm2Repetitions: next.repetitions,
                    sm2Interval: next.interval,
                    sm2Easiness: next.easiness,
                    dueAt: next.dueAt,
                    lastReviewedAt: now,
                },
            },
        )

        return NextResponse.json({
            success: true,
            cardId: id,
            sm2: next,
        })
    } catch (err) {
        console.error("Review error", err)
        return NextResponse.json(
            { error: "Không cập nhật được lịch ôn" },
            { status: 500 },
        )
    }
}
