// app/api/decks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
    getDecksCollection,
    getFlashcardsCollection,
    getQuestionsCollection,
    ObjectId,
} from "@/lib/mongodb"

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
        return NextResponse.json(
            { error: "deckId khÃ´ng há»£p lá»" },
            { status: 400 },
        )
    }

    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne({ _id: new ObjectId(id) })

    if (!deck) {
        return NextResponse.json(
            { error: "KhÃ´ng tÃ¬m tháº¥y deck" },
            { status: 404 },
        )
    }

    return NextResponse.json({
        ...deck,
        _id: deck._id?.toString(),
    })
}


export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params

    if (!ObjectId.isValid(id)) {
        return NextResponse.json(
            { error: "deckId không hợp lệ" },
            { status: 400 },
        )
    }

    const deckObjectId = new ObjectId(id)

    try {
        const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
            getDecksCollection(),
            getFlashcardsCollection(),
            getQuestionsCollection(),
        ])

        await Promise.all([
            flashcardsCol.deleteMany({ deckId: deckObjectId }),
            questionsCol.deleteMany({ deckId: deckObjectId }),
            decksCol.deleteOne({ _id: deckObjectId }),
        ])

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting deck", error)
        return NextResponse.json(
            { error: "Không xoá được deck" },
            { status: 500 },
        )
    }
}
