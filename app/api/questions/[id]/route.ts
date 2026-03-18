import { NextRequest, NextResponse } from "next/server"
import { getQuestionsCollection, getDecksCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { normalizeImage, normalizeTags } from "@/lib/normalize"

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
      { error: "Invalid questionId" },
      { status: 400 },
    )
  }

  const questionsCol = await getQuestionsCollection()
  const question = await questionsCol.findOne({ _id: new ObjectId(id) })

  if (!question) {
    return NextResponse.json(
      { error: "Question not found" },
      { status: 404 },
    )
  }

  // Verify deck ownership
  const decksCol = await getDecksCollection()
  const deck = await decksCol.findOne(
    getOwnedActiveDeckFilter(userId, { _id: question.deckId }),
  )
  if (!deck) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...question,
    _id: question._id.toString(),
    deckId: question.deckId.toString(),
    flashcardId: question.flashcardId?.toString(),
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
        { error: "Invalid questionId" },
        { status: 400 },
      )
    }

    const questionsCol = await getQuestionsCollection()
    const existing = await questionsCol.findOne({ _id: new ObjectId(id) })
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne(
      getOwnedActiveDeckFilter(userId, { _id: existing.deckId }),
    )
    if (!deck) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
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
        .map((c: Record<string, unknown>) => ({
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
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await props.params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid questionId" },
        { status: 400 },
      )
    }

    const questionsCol = await getQuestionsCollection()
    const question = await questionsCol.findOne({ _id: new ObjectId(id) })
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne(
      getOwnedActiveDeckFilter(userId, { _id: question.deckId }),
    )
    if (!deck) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

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
