import { notFound } from "next/navigation"
import {
    getDecksCollection,
    getFlashcardsCollection,
    ObjectId,
} from "@/lib/mongodb"
import FlashcardStudyClient from "./FlashcardStudyClient"

function shuffle<T>(items: T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = copy[i]
        copy[i] = copy[j]
        copy[j] = temp
    }
    return copy
}


export default async function DeckFlashcardsPage(
    props: {
        params: Promise<{ deckId: string }>
        searchParams?: Promise<{ mode?: string; subject?: string }>
    },
) {
    const { deckId } = await props.params
    const searchParams = props.searchParams ? await props.searchParams : {}
    const mode = typeof searchParams?.mode === "string" ? searchParams.mode : "due"
    const subject =
        typeof searchParams?.subject === "string" ? searchParams.subject : undefined

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

    const now = new Date()

    const query =
        mode === "due"
            ? {
                deckId: _id,
                $or: [
                    { dueAt: { $exists: false } },
                    { dueAt: null },
                    { dueAt: { $lte: now } },
                ],
            }
            : { deckId: _id }

    const sort: Record<string, 1 | -1> =
        mode === "due" ? { dueAt: 1 } : { order: 1, createdAt: 1 }

    const flashcards = await flashcardsCol
        .find(query)
        .sort(sort)
        .toArray()

    const cards = flashcards.map((c) => ({
        _id: c._id.toString(),
        front: String(c.front ?? ""),
        back: String(c.back ?? ""),
        frontImage: typeof c.frontImage === "string" ? c.frontImage : "",
        backImage: typeof c.backImage === "string" ? c.backImage : "",
        dueAt: c.dueAt ? new Date(c.dueAt).toISOString() : null,
        reviewRating: typeof c.reviewRating === "string" ? c.reviewRating : null,
        note: typeof c.note === "string" ? c.note : "",
    }))


    const deckName = String(deck.name ?? "Deck")

    const displayCards = mode === "mix" ? shuffle(cards) : cards

    return (
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 py-6">
            <FlashcardStudyClient
                deckId={deckId}
                deckName={deckName}
                mode={mode}
                subject={subject}
                cards={displayCards}
            />
        </main>
    )
}
