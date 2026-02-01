// app/api/import/manual-json/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  ObjectId,
} from "@/lib/mongodb"
import { getDefaultDeckOptions } from "@/lib/fsrs"

export const runtime = "nodejs"

// ===== Ki?u d? li?u ===== //
interface ManualFlashcard {
  front: string
  back: string
  frontImage?: string
  backImage?: string
  tags?: string[]
}

interface ManualChoice {
  text: string
  isCorrect: boolean
  image?: string
}

interface ManualQuestion {
  question: string
  choices: ManualChoice[]
  image?: string
  explanation?: string
  tags?: string[]
}

interface ManualImportPayload {
  deckId?: string
  deckName?: string
  description?: string
  subject?: string
  flashcards?: ManualFlashcard[]
  questions?: ManualQuestion[]
}

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

  if (tags.length === 0) return undefined
  return Array.from(new Set(tags))
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ManualImportPayload

    const deckIdRaw =
      typeof body.deckId === "string" ? body.deckId.trim() : ""
    const deckNameInput =
      typeof body.deckName === "string" ? body.deckName.trim() : ""

    const flashcards = Array.isArray(body.flashcards) ? body.flashcards : []
    const questions = Array.isArray(body.questions) ? body.questions : []

    if (flashcards.length === 0 && questions.length === 0) {
      return NextResponse.json(
        {
          error:
            "JSON has no flashcards or questions. Need at least one of the two.",
        },
        { status: 400 },
      )
    }

    const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
      getDecksCollection(),
      getFlashcardsCollection(),
      getQuestionsCollection(),
    ])

    const now = new Date()

    let deckId: ObjectId
    let deckName = deckNameInput
    let mode: "new" | "append" = "new"

    if (deckIdRaw) {
      if (!ObjectId.isValid(deckIdRaw)) {
        return NextResponse.json({ error: "Invalid deckId" }, { status: 400 })
      }

      const existing = await decksCol.findOne({ _id: new ObjectId(deckIdRaw) })
      if (!existing) {
        return NextResponse.json(
          { error: "Deck not found for append" },
          { status: 404 },
        )
      }

      deckId = existing._id
      deckName = deckNameInput || String(existing.name ?? "")
      mode = "append"

      const updateFields: Record<string, unknown> = { updatedAt: now }
      if (deckNameInput) {
        updateFields.name = deckNameInput
      }
      if (typeof body.description === "string" && body.description.trim()) {
        updateFields.description = body.description.trim()
      }
      if (typeof body.subject === "string" && body.subject.trim()) {
        updateFields.subject = body.subject.trim()
      }

      await decksCol.updateOne({ _id: deckId }, { $set: updateFields })
    } else {
      if (!deckNameInput) {
        return NextResponse.json(
          { error: "Missing deckName or deckId" },
          { status: 400 },
        )
      }

      const deckInsert = await decksCol.insertOne({
        name: deckNameInput,
        description: body.description?.trim() || undefined,
        subject: body.subject?.trim() || undefined,
        options: getDefaultDeckOptions(),
        createdAt: now,
        updatedAt: now,
      })
      deckId = deckInsert.insertedId
      deckName = deckNameInput
      mode = "new"
    }

    let insertedFlashcardCount = 0
    let insertedQuestionCount = 0

    if (flashcards.length > 0) {
      const baseOrder =
        mode === "append" ? await flashcardsCol.countDocuments({ deckId }) : 0
      const fcDocs = flashcards
        .map((fc: ManualFlashcard, index: number) => ({
          deckId,
          front: fc.front?.toString().trim(),
          back: fc.back?.toString().trim(),
          frontImage: normalizeImage(fc.frontImage),
          backImage: normalizeImage(fc.backImage),
          tags: normalizeTags(fc.tags),
          order: baseOrder + index,
          level: 0,
          createdAt: now,
          updatedAt: now,
        }))
        .filter((f: { front: string; back: string }) => f.front && f.back)

      if (fcDocs.length) {
        await flashcardsCol.insertMany(fcDocs)
        insertedFlashcardCount = fcDocs.length
      }
    }

    if (questions.length > 0) {
      const baseOrder =
        mode === "append" ? await questionsCol.countDocuments({ deckId }) : 0
      const qDocs = questions
        .map((q: ManualQuestion, index: number) => {
          const question = q.question?.toString().trim()
          const choices: ManualChoice[] = Array.isArray(q.choices)
            ? q.choices
            : []

          const normalizedChoices = choices
            .map((c: ManualChoice) => ({
              text: c.text?.toString().trim(),
              isCorrect: Boolean(c.isCorrect),
              image: normalizeImage(c.image),
            }))
            .filter((c) => c.text)

          return {
            deckId,
            question,
            choices: normalizedChoices,
            image: normalizeImage(q.image),
            explanation: q.explanation
              ? q.explanation.toString().trim()
              : undefined,
            tags: normalizeTags(q.tags),
            order: baseOrder + index,
            level: 0,
            createdAt: now,
            updatedAt: now,
          }
        })
        .filter(
          (q) =>
            q.question &&
            q.choices.length >= 2 &&
            q.choices.some((c) => c.isCorrect),
        )

      if (qDocs.length) {
        await questionsCol.insertMany(qDocs)
        insertedQuestionCount = qDocs.length
      }
    }

    return NextResponse.json({
      success: true,
      mode,
      deckId: deckId.toString(),
      deckName,
      flashcardCount: insertedFlashcardCount,
      questionCount: insertedQuestionCount,
    })
  } catch (error) {
    console.error("Error in /api/import/manual-json", error)
    return NextResponse.json(
      { error: "Kh?ng th? import JSON th? c?ng" },
      { status: 500 },
    )
  }
}
