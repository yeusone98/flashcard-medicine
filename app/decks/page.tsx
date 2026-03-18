import type { Metadata } from "next"

import {
  getOwnedActiveDeckFilter,
  getOwnedDeletedDeckFilter,
} from "@/lib/decks"
import { getDecksCollection, ObjectId } from "@/lib/mongodb"
import { requireSession } from "@/lib/require-user"

import { DecksPageClient, type DeckItem } from "./decks-page-client"

interface DeckDoc {
  _id: ObjectId
  name: string
  description?: string
  subject?: string | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
}

export const metadata: Metadata = {
  title: "Bộ thẻ | Flashcard Medicine",
}

export default async function DeckListPage(props: {
  searchParams?: Promise<{ subject?: string; view?: string }>
}) {
  const { userId } = await requireSession()
  const searchParams = props.searchParams ? await props.searchParams : {}
  const view = searchParams?.view === "trash" ? "trash" : "active"

  const decksCol = await getDecksCollection()
  const docs = (await decksCol
    .find(
      view === "trash"
        ? getOwnedDeletedDeckFilter(userId)
        : getOwnedActiveDeckFilter(userId),
      {
        projection: {
          name: 1,
          description: 1,
          subject: 1,
          createdAt: 1,
          updatedAt: 1,
          deletedAt: 1,
        },
      },
    )
    .sort(view === "trash" ? { deletedAt: -1, updatedAt: -1 } : { createdAt: -1 })
    .toArray()) as DeckDoc[]

  const now = new Date()
  const decks: DeckItem[] = docs.map((deck) => ({
    _id: deck._id.toString(),
    name: deck.name,
    description: deck.description ?? "",
    subject: deck.subject ?? undefined,
    createdAt: (deck.createdAt ?? now).toISOString(),
    updatedAt: (deck.updatedAt ?? deck.createdAt ?? now).toISOString(),
    deletedAt: deck.deletedAt ? deck.deletedAt.toISOString() : undefined,
  }))

  return <DecksPageClient initialDecks={decks} initialView={view} />
}
