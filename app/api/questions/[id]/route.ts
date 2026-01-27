import { NextRequest, NextResponse } from "next/server"
import { getQuestionsCollection, ObjectId } from "@/lib/mongodb"

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
        { error: "Invalid questionId" },
        { status: 400 },
      )
    }

    const body = await req.json().catch(() => ({}))

    const update: Record<string, unknown> = {}
    if (typeof body.question === "string") update.question = body.question.trim()
    if (typeof body.explanation === "string") {
      update.explanation = body.explanation.trim()
    }
    if ("image" in body) {
      update.image = normalizeImage(body.image) ?? ""
    }
    if ("tags" in body) {
      update.tags = normalizeTags(body.tags)
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      update.order = body.order
    }

    if (Array.isArray(body.choices)) {
      const choices = body.choices
        .map((c: any) => ({
          text: typeof c?.text === "string" ? c.text.trim() : "",
          isCorrect: Boolean(c?.isCorrect),
          image: normalizeImage(c?.image),
        }))
        .filter((c: { text: string }) => c.text)

      if (choices.length >= 2 && choices.some((c: { isCorrect: boolean }) => c.isCorrect)) {
        update.choices = choices
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      )
    }

    update.updatedAt = new Date()

    const questionsCol = await getQuestionsCollection()
    const result = await questionsCol.updateOne(
      { _id: new ObjectId(id) },
      { $set: update },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating question", error)
    return NextResponse.json(
      { error: "Failed to update question" },
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
        { error: "Invalid questionId" },
        { status: 400 },
      )
    }

    const questionsCol = await getQuestionsCollection()
    const result = await questionsCol.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting question", error)
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 },
    )
  }
}
