import { notFound } from "next/navigation"
import { connectDB } from "@/lib/mongodb"
import Deck from "@/models/Deck"
import Flashcard from "@/models/Flashcard"
import FlashcardStudyClient from "./FlashcardStudyClient"

// KHÔNG dùng PageProps nữa, để Next tự lo cho props

export default async function DeckFlashcardsPage(
    props: { params: Promise<{ deckId: string }> }
) {
    // 🔥 Quan trọng: params là Promise → phải await
    const { deckId } = await props.params

    await connectDB()

    const deck = await Deck.findById(deckId).lean()
    if (!deck) {
        return notFound()
    }

    const flashcards = await Flashcard.find({ deckId })
        .sort({ createdAt: 1 })
        .lean()

    const cards = flashcards.map((c: any) => ({
        _id: c._id.toString(),
        front: String(c.front ?? ""),
        back: String(c.back ?? ""),
    }))

    const deckName = String((deck as any).name ?? "Deck")

    return (
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 py-6">
            <FlashcardStudyClient
                deckId={deckId}
                deckName={deckName}
                cards={cards}
            />
        </main>
    )
}
