import { notFound } from "next/navigation"
import {
    getDecksCollection,
    getFlashcardsCollection,
    getReviewLogsCollection,
    ObjectId,
} from "@/lib/mongodb"
import { mapStateToQueue, normalizeDeckOptions } from "@/lib/fsrs"
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

const normalizeFields = (
    value: unknown,
): Record<string, string> | undefined => {
    if (!value || typeof value !== "object") return undefined
    const entries = Object.entries(value as Record<string, unknown>)
    const output: Record<string, string> = {}
    for (const [key, raw] of entries) {
        const trimmedKey = String(key || "").trim()
        if (!trimmedKey) continue
        output[trimmedKey] =
            typeof raw === "string"
                ? raw
                : raw === null || raw === undefined
                    ? ""
                    : String(raw)
    }
    return Object.keys(output).length > 0 ? output : undefined
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

    let flashcards = await flashcardsCol
        .find(query)
        .sort(sort)
        .toArray()

    if (mode === "due") {
        const deckOptions = normalizeDeckOptions(deck.options ?? null)
        const reviewLogsCol = await getReviewLogsCollection()
        const startOfDay = new Date(now)
        startOfDay.setHours(0, 0, 0, 0)

        const reviewCounts = await reviewLogsCol
            .aggregate([
                { $match: { deckId: _id, createdAt: { $gte: startOfDay } } },
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

        const filtered: typeof flashcards = []

        for (const card of flashcards) {
            const queue = mapStateToQueue(card.fsrsState)
            if (queue === "new") {
                if (remainingNew <= 0) continue
                remainingNew -= 1
                filtered.push(card)
                continue
            }

            if (queue === "review") {
                if (remainingReview <= 0) continue
                remainingReview -= 1
                filtered.push(card)
                continue
            }

            filtered.push(card)
        }

        flashcards = filtered
    }

    const cards = flashcards.map((c) => ({
        _id: c._id.toString(),
        front: String(c.front ?? ""),
        back: String(c.back ?? ""),
        frontImage:
            typeof c.frontImage === "string"
                ? c.frontImage
                : typeof (c as { frontImageUrl?: string }).frontImageUrl === "string"
                    ? (c as { frontImageUrl?: string }).frontImageUrl
                    : "",
        backImage:
            typeof c.backImage === "string"
                ? c.backImage
                : typeof (c as { backImageUrl?: string }).backImageUrl === "string"
                    ? (c as { backImageUrl?: string }).backImageUrl
                    : "",
        frontAudio: typeof c.frontAudio === "string" ? c.frontAudio : "",
        backAudio: typeof c.backAudio === "string" ? c.backAudio : "",
        fields: normalizeFields(c.fields),
        dueAt: c.dueAt ? new Date(c.dueAt).toISOString() : null,
        reviewRating: typeof c.reviewRating === "string" ? c.reviewRating : null,
        note: typeof c.note === "string" ? c.note : "",
    }))


    const deckName = String(deck.name ?? "Deck")

    const displayCards = mode === "mix" ? shuffle(cards) : cards

    return (
        <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-5xl px-4 py-6 stagger">
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
