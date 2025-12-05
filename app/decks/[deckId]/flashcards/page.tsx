import { notFound } from "next/navigation"
import {
    getDecksCollection,
    getFlashcardsCollection,
    ObjectId,
} from "@/lib/mongodb"
import FlashcardStudyClient from "./FlashcardStudyClient"

export default async function DeckFlashcardsPage(
    props: { params: Promise<{ deckId: string }> },
) {
    const { deckId } = await props.params

    if (!ObjectId.isValid(deckId)) {
        return notFound()
    }

    const [decksCol, flashcardsCol] = await Promise.all([
        getDecksCollection(),
        getFlashcardsCollection(),
    ])

    const _id = new ObjectId(deckId)

    const deck = await decksCol.findOne({ _id })
    if (!deck) {
        return notFound()
    }

    const flashcards = await flashcardsCol
        .find({ deckId: _id })
        .sort({ createdAt: 1 })
        .toArray()

    const cards = flashcards.map((c) => ({
        _id: c._id.toString(),
        front: String(c.front ?? ""),
        back: String(c.back ?? ""),
        note: typeof c.note === "string" ? c.note : "",
    }))


    const deckName = String(deck.name ?? "Deck")

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
