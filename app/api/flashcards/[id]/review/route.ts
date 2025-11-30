// app/api/flashcards/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Flashcard from "@/models/Flashcard"
import { applySm2, Sm2Grade } from "@/lib/srs"

export async function POST(
    req: NextRequest,
    props: { params: Promise<{ id: string }> } // 👈 params là Promise
) {
    try {
        // 🔥 Quan trọng: phải await props.params
        const { id } = await props.params

        const body = await req.json().catch(() => ({}))
        const grade = Number(body.grade) as Sm2Grade

        if (Number.isNaN(grade) || grade < 0 || grade > 5) {
            return NextResponse.json(
                { error: "grade phải trong khoảng 0–5" },
                { status: 400 }
            )
        }

        await connectDB()

        const card = await Flashcard.findById(id)
        if (!card) {
            return NextResponse.json(
                { error: "Flashcard không tồn tại" },
                { status: 404 }
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
            now
        )

        card.sm2Repetitions = next.repetitions
        card.sm2Interval = next.interval
        card.sm2Easiness = next.easiness
        card.dueAt = next.dueAt
        card.lastReviewedAt = now

        await card.save()

        return NextResponse.json({
            success: true,
            cardId: card._id,
            sm2: next,
        })
    } catch (err) {
        console.error("Review error", err)
        return NextResponse.json(
            { error: "Không cập nhật được lịch ôn" },
            { status: 500 }
        )
    }
}
