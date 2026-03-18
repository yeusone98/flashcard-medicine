import { NextRequest, NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedDeletedDeckFilter } from "@/lib/decks"
import { getDecksCollection, ObjectId } from "@/lib/mongodb"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deckId" }, { status: 400 })
  }

  try {
    const decksCol = await getDecksCollection()
    const deckObjectId = new ObjectId(id)
    const result = await decksCol.updateOne(
      getOwnedDeletedDeckFilter(userId, { _id: deckObjectId }),
      {
        $unset: { deletedAt: "" },
        $set: { updatedAt: new Date() },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error restoring deck", error)
    return NextResponse.json(
      { error: "Failed to restore deck" },
      { status: 500 },
    )
  }
}
