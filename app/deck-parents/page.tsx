// app/deck-parents/page.tsx
import { requireSession } from "@/lib/require-user"
import { getDecksCollection } from "@/lib/mongodb"

interface ParentRow {
  _id: string | null
  count: number
}

export interface ParentInfo {
  name: string
  deckCount: number
}

import { DeckParentsClient } from "./deck-parents-client"

export default async function DeckParentsPage() {
  await requireSession()

  const decksCol = await getDecksCollection()

  const rows = (await decksCol
    .aggregate<ParentRow>([
      {
        $group: {
          _id: "$subject",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()) as ParentRow[]

  const parents: ParentInfo[] = rows
    .filter((r) => typeof r._id === "string" && r._id.trim().length > 0)
    .map((r) => ({
      name: (r._id as string).trim(),
      deckCount: r.count ?? 0,
    }))

  return <DeckParentsClient parents={parents} />
}
