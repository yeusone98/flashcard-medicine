// app/api/decks/[id]/clone/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  ObjectId,
} from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { createDeck, getActiveDeckFilter } from "@/lib/decks"

export const runtime = "nodejs"

// POST — clone deck công khai vào tài khoản của user đang đăng nhập
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

    const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
      getDecksCollection(),
      getFlashcardsCollection(),
      getQuestionsCollection(),
    ])

    // Deck phải public mới clone được
    const sourceDeck = await decksCol.findOne(
      getActiveDeckFilter({
        _id: new ObjectId(id),
        isPublic: true,
      }),
    )

    if (!sourceDeck) {
      return NextResponse.json(
        { error: "Deck không tồn tại hoặc chưa được chia sẻ công khai" },
        { status: 404 },
      )
    }

    const now = new Date()

    // Tạo deck mới cho user
    const newDeckInsert = await createDeck({
      userId,
      name: `[Clone] ${sourceDeck.name}`,
      description: sourceDeck.description,
      subject: sourceDeck.subject,
      options: sourceDeck.options,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      decksCol,
    })

    const newDeckId = newDeckInsert.insertedId

    // Copy flashcards
    const flashcards = await flashcardsCol
      .find({ deckId: new ObjectId(id) })
      .toArray()

    if (flashcards.length > 0) {
      await flashcardsCol.insertMany(
        flashcards.map((card) => {
          const { _id, ...rest } = card
          void _id

          return {
            ...rest,
            deckId: newDeckId,
            // Reset FSRS state
            level: 0,
            dueAt: null,
            lastReviewedAt: undefined,
            fsrsState: undefined,
            fsrsStability: undefined,
            fsrsDifficulty: undefined,
            fsrsElapsedDays: undefined,
            fsrsScheduledDays: undefined,
            fsrsReps: undefined,
            fsrsLapses: undefined,
            reviewRating: undefined,
            createdAt: now,
            updatedAt: now,
          }
        }),
      )
    }

    // Copy questions
    const questions = await questionsCol
      .find({ deckId: new ObjectId(id) })
      .toArray()

    if (questions.length > 0) {
      await questionsCol.insertMany(
        questions.map((question) => {
          const { _id, ...rest } = question
          void _id

          return {
            ...rest,
            deckId: newDeckId,
            flashcardId: undefined,
            // Reset FSRS state
            level: 0,
            dueAt: null,
            lastReviewedAt: undefined,
            fsrsState: undefined,
            fsrsStability: undefined,
            fsrsDifficulty: undefined,
            fsrsElapsedDays: undefined,
            fsrsScheduledDays: undefined,
            fsrsReps: undefined,
            fsrsLapses: undefined,
            reviewRating: undefined,
            createdAt: now,
            updatedAt: now,
          }
        }),
      )
    }

    return NextResponse.json({
      newDeckId: newDeckId.toString(),
      flashcardCount: flashcards.length,
      questionCount: questions.length,
    })
  } catch (err) {
    console.error("Error cloning deck", err)
    return NextResponse.json({ error: "Không thể clone deck" }, { status: 500 })
  }
}
