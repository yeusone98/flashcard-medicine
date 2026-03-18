// app/api/decks/[id]/share/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDecksCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"

export const runtime = "nodejs"

// POST — bật public và sinh shareToken
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid deckId" }, { status: 400 })
    }

    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne(
      getOwnedActiveDeckFilter(userId, { _id: new ObjectId(id) }),
    )

    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    // Dùng lại token nếu đã có, hoặc sinh mới
    const shareToken = deck.shareToken ?? crypto.randomUUID()

    await decksCol.updateOne(
      getOwnedActiveDeckFilter(userId, { _id: new ObjectId(id) }),
      { $set: { isPublic: true, shareToken, updatedAt: new Date() } },
    )

    return NextResponse.json({ shareToken, isPublic: true })
  } catch (err) {
    console.error("Error sharing deck", err)
    return NextResponse.json({ error: "Không thể chia sẻ deck" }, { status: 500 })
  }
}

// DELETE — tắt public (giữ token để có thể bật lại)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid deckId" }, { status: 400 })
    }

    const decksCol = await getDecksCollection()
    const result = await decksCol.updateOne(
      getOwnedActiveDeckFilter(userId, { _id: new ObjectId(id) }),
      { $set: { isPublic: false, updatedAt: new Date() } },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    return NextResponse.json({ isPublic: false })
  } catch (err) {
    console.error("Error unsharing deck", err)
    return NextResponse.json({ error: "Không thể tắt chia sẻ" }, { status: 500 })
  }
}
