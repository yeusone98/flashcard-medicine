// app/api/flashcards/[id]/note/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, ObjectId } from "@/lib/mongodb"

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
        const rawNote = body?.note

        const note =
            typeof rawNote === "string"
                ? rawNote
                : rawNote === null || rawNote === undefined
                    ? ""
                    : String(rawNote)

        const flashcardsCol = await getFlashcardsCollection()
        const _id = new ObjectId(id)

        const card = await flashcardsCol.findOne({ _id })
        if (!card) {
            return NextResponse.json(
                { error: "Không tìm thấy flashcard" },
                { status: 404 },
            )
        }

        await flashcardsCol.updateOne(
            { _id },
            {
                $set: {
                    note,
                    updatedAt: new Date(),
                },
            },
        )

        return NextResponse.json({
            success: true,
            cardId: id,
            note,
        })
    } catch (err) {
        console.error("Note error", err)
        return NextResponse.json(
            { error: "Không lưu được ghi chú" },
            { status: 500 },
        )
    }
}
