import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, ObjectId } from "@/lib/mongodb"

function normalizeImage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeTags(value: unknown): string[] | undefined {
  const raw =
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : []

  const tags = raw
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter((tag) => tag.length > 0)

  if (tags.length === 0) return []
  return Array.from(new Set(tags))
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid flashcardId" },
        { status: 400 },
      )
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
    if ("tags" in body) {
      update.tags = normalizeTags(body.tags)
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

    const flashcardsCol = await getFlashcardsCollection()
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
    const { id } = await props.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid flashcardId" },
        { status: 400 },
      )
    }

    const flashcardsCol = await getFlashcardsCollection()
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
