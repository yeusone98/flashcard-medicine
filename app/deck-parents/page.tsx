// app/deck-parents/page.tsx
import { requireSession } from "@/lib/require-user"
import { getDeckParentsCollection, getDecksCollection, ObjectId } from "@/lib/mongodb"

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
  const { userId } = await requireSession()

  const [decksCol, parentsCol] = await Promise.all([
    getDecksCollection(),
    getDeckParentsCollection(),
  ])

  const rows = (await decksCol
    .aggregate<ParentRow>([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: "$subject",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray()) as ParentRow[]

  const storedParents = await parentsCol
    .find({ userId: new ObjectId(userId) }, { projection: { name: 1 } })
    .toArray()

  const deckCountByName = new Map(
    rows
      .filter((r) => typeof r._id === "string" && r._id.trim().length > 0)
      .map((r) => [(r._id as string).trim(), r.count ?? 0]),
  )

  const mergedNames = [
    ...Array.from(deckCountByName.keys()),
    ...storedParents
      .map((p) => (typeof p.name === "string" ? p.name.trim() : ""))
      .filter(Boolean),
  ]

  const nameByLower = new Map<string, string>()
  mergedNames.forEach((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    if (!nameByLower.has(lower)) {
      nameByLower.set(lower, trimmed)
    }
  })

  const uniqueNames = Array.from(nameByLower.values())

  const parents: ParentInfo[] = uniqueNames.map((name) => ({
    name,
    deckCount: deckCountByName.get(name) ?? 0,
  }))

  parents.sort((a, b) => a.name.localeCompare(b.name, "vi"))

  return <DeckParentsClient parents={parents} />
}
