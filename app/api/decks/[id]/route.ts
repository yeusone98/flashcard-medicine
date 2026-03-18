// app/api/decks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { normalizeDeckOptions } from "@/lib/fsrs"
import { getDecksCollection, ObjectId } from "@/lib/mongodb"

export async function GET(
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

  const decksCol = await getDecksCollection()
  const deck = await decksCol.findOne(
    getOwnedActiveDeckFilter(userId, { _id: new ObjectId(id) }),
  )

  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...deck,
    _id: deck._id?.toString(),
  })
}

export async function DELETE(
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
    const deckObjectId = new ObjectId(id)
    const decksCol = await getDecksCollection()
    const result = await decksCol.updateOne(
      getOwnedActiveDeckFilter(userId, { _id: deckObjectId }),
      {
        $set: {
          deletedAt: new Date(),
          isPublic: false,
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting deck", error)
    return NextResponse.json(
      { error: "Failed to delete deck" },
      { status: 500 },
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const { id } = await params
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid deckId" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const deckObjectId = new ObjectId(id)
  const decksCol = await getDecksCollection()
  const existing = await decksCol.findOne(
    getOwnedActiveDeckFilter(userId, { _id: deckObjectId }),
  )

  if (!existing) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 })
  }

  const update: Record<string, unknown> = {}

  if (typeof body.name === "string") {
    const trimmed = body.name.trim()
    if (!trimmed) {
      return NextResponse.json(
        { error: "Deck name cannot be empty" },
        { status: 400 },
      )
    }
    update.name = trimmed
  }

  if (typeof body.description === "string") {
    update.description = body.description.trim()
  }

  if (typeof body.subject === "string") {
    update.subject = body.subject.trim()
  }

  if (body?.options && typeof body.options === "object") {
    const baseOptions = normalizeDeckOptions(existing.options ?? null)
    const optionPatch: Record<string, unknown> = {}

    if ("newPerDay" in body.options) {
      optionPatch.newPerDay = body.options.newPerDay
    }
    if ("reviewPerDay" in body.options) {
      optionPatch.reviewPerDay = body.options.reviewPerDay
    }
    if ("learningSteps" in body.options) {
      optionPatch.learningSteps = body.options.learningSteps
    }
    if ("relearningSteps" in body.options) {
      optionPatch.relearningSteps = body.options.relearningSteps
    }

    if (Object.keys(optionPatch).length > 0) {
      update.options = normalizeDeckOptions({
        ...baseOptions,
        ...optionPatch,
      })
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  update.updatedAt = new Date()

  try {
    const result = await decksCol.updateOne(
      getOwnedActiveDeckFilter(userId, { _id: deckObjectId }),
      { $set: update },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating deck", error)
    return NextResponse.json(
      { error: "Failed to update deck" },
      { status: 500 },
    )
  }
}
