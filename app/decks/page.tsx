// app/decks/page.tsx
import type { Metadata } from "next"
import type { ObjectId } from "mongodb"

import { requireSession } from "@/lib/require-user"
import { getDecksCollection } from "@/lib/mongodb"
import { DecksPageClient, type DeckItem } from "./decks-page-client"

interface DeckDoc {
  _id: ObjectId
  name: string
  description?: string
  subject?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export const metadata: Metadata = {
  title: "Bộ thẻ | Flashcard Medicine",
}

export default async function DeckListPage() {
  await requireSession()

  const decksCol = await getDecksCollection()

  const docs = (await decksCol
    .find(
      {},
      {
        projection: {
          name: 1,
          description: 1,
          subject: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .toArray()) as DeckDoc[]

  const now = new Date()

  const decks: DeckItem[] = docs.map((d) => ({
    _id: d._id.toString(),
    name: d.name,
    description: d.description ?? "",
    subject: d.subject ?? undefined,
    createdAt: (d.createdAt ?? now).toISOString(),
    updatedAt: (d.updatedAt ?? d.createdAt ?? now).toISOString(),
  }))

  return <DecksPageClient initialDecks={decks} />
}
