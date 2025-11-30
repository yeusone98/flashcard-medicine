// app/api/decks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import mongoose from "mongoose"
import { connectDB } from "@/lib/mongodb"
import Deck from "@/models/Deck"
import Flashcard from "@/models/Flashcard"
import Question from "@/models/Question"

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> } // 👈 params là Promise
) {
    // Bắt buộc phải await
    const { id } = await params
    const deckId = id

    console.log("DELETE /api/decks/[id]", { deckId })

    if (!deckId) {
        return NextResponse.json(
            { error: "Thiếu deckId trong URL" },
            { status: 400 }
        )
    }

    if (!mongoose.Types.ObjectId.isValid(deckId)) {
        return NextResponse.json(
            { error: "deckId không hợp lệ" },
            { status: 400 }
        )
    }

    try {
        await connectDB()

        const deck = await Deck.findById(deckId)

        console.log("Found deck?", !!deck)

        if (!deck) {
            return NextResponse.json(
                { error: "Deck không tồn tại" },
                { status: 404 }
            )
        }

        await Flashcard.deleteMany({ deckId })
        await Question.deleteMany({ deckId })
        await Deck.findByIdAndDelete(deckId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error deleting deck", error)
        return NextResponse.json(
            { error: "Không xoá được deck" },
            { status: 500 }
        )
    }
}
