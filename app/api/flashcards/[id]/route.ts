import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, getDecksCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { normalizeImage, normalizeTags, normalizeFields } from "@/lib/normalize"

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const { id } = await props.params

  if (!ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid flashcardId" },
      { status: 400 },
    )
  }

  const flashcardsCol = await getFlashcardsCollection()
  const card = await flashcardsCol.findOne({ _id: new ObjectId(id) })

  if (!card) {
    return NextResponse.json(
      { error: "Flashcard not found" },
      { status: 404 },
    )
  }

  // Verify deck ownership
  const decksCol = await getDecksCollection()
  const deck = await decksCol.findOne(
    getOwnedActiveDeckFilter(userId, { _id: card.deckId }),
  )
  if (!deck) {
    return NextResponse.json({ error: "Flashcard not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...card,
    _id: card._id.toString(),
    deckId: card.deckId.toString(),
  })
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await props.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid flashcardId" },
        { status: 400 },
      )
    }

    const flashcardsCol = await getFlashcardsCollection()
    const card = await flashcardsCol.findOne({ _id: new ObjectId(id) })
    if (!card) {
      return NextResponse.json({ error: "Flashcard not found" }, { status: 404 })
    }

    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne(
      getOwnedActiveDeckFilter(userId, { _id: card.deckId }),
    )
    if (!deck) {
      return NextResponse.json({ error: "Flashcard not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))

    const update: Record<string, unknown> = {}
    if (typeof body.front === "string") update.front = body.front.trim()
    if (typeof body.back === "string") update.back = body.back.trim()
    if ("frontImage" in body) {
      update.frontImage = normalizeImage(body.frontImage) ?? ""
    }
    if ("backImage" in body) {
      update.backImage = normalizeImage(body.backImage) ?? ""
    }
    if ("frontAudio" in body) {
      update.frontAudio = normalizeImage(body.frontAudio) ?? ""
    }
    if ("backAudio" in body) {
      update.backAudio = normalizeImage(body.backAudio) ?? ""
    }
    if ("tags" in body) {
      update.tags = normalizeTags(body.tags)
    }
    if ("fields" in body) {
      update.fields = normalizeFields(body.fields) ?? {}
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      update.order = body.order
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      )
    }

    update.updatedAt = new Date()

    const result = await flashcardsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: update },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Flashcard not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating flashcard", error)
    return NextResponse.json(
      { error: "Failed to update flashcard" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await props.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid flashcardId" },
        { status: 400 },
      )
    }

    const flashcardsCol = await getFlashcardsCollection()
    const card = await flashcardsCol.findOne({ _id: new ObjectId(id) })
    if (!card) {
      return NextResponse.json({ error: "Flashcard not found" }, { status: 404 })
    }

    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne(
      getOwnedActiveDeckFilter(userId, { _id: card.deckId }),
    )
    if (!deck) {
      return NextResponse.json({ error: "Flashcard not found" }, { status: 404 })
    }

    const result = await flashcardsCol.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Flashcard not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting flashcard", error)
    return NextResponse.json(
      { error: "Failed to delete flashcard" },
      { status: 500 },
    )
  }
}
