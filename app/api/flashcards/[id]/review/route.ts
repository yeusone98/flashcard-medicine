// app/api/flashcards/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getReviewLogsCollection,
  ObjectId,
} from "@/lib/mongodb"
import {
  buildFsrsCard,
  mapFlashcardRating,
  mapRatingToLabel,
  mapStateToLabel,
  normalizeDeckOptions,
  scheduleFsrsReview,
} from "@/lib/fsrs"

type SimpleRating = "hard" | "medium" | "easy"

export async function POST(
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
    const rating = String(body.rating ?? "") as SimpleRating

    if (!["hard", "medium", "easy"].includes(rating)) {
      return NextResponse.json(
        { error: "rating must be 'hard' | 'medium' | 'easy'" },
        { status: 400 },
      )
    }

    const [flashcardsCol, decksCol, reviewLogsCol] = await Promise.all([
      getFlashcardsCollection(),
      getDecksCollection(),
      getReviewLogsCollection(),
    ])
    const _id = new ObjectId(id)

    const card = await flashcardsCol.findOne({ _id })
    if (!card) {
      return NextResponse.json(
        { error: "Flashcard not found" },
        { status: 404 },
      )
    }

    const deck = await decksCol.findOne({ _id: card.deckId })
    const deckOptions = normalizeDeckOptions(deck?.options ?? null)

    const now = new Date()
    const fsrsCard = buildFsrsCard(card, now)
    const fsrsRating = mapFlashcardRating(rating)

    const result = scheduleFsrsReview(fsrsCard, fsrsRating, now, deckOptions)
    const nextCard = result.card
    const log = result.log

    const intervalMinutes = Math.max(
      1,
      Math.round((nextCard.due.getTime() - now.getTime()) / (60 * 1000)),
    )
    const intervalDays = Math.max(0, Math.round(nextCard.scheduled_days))

    await flashcardsCol.updateOne(
      { _id },
      {
        $set: {
          lastReviewedAt: now,
          dueAt: nextCard.due,
          fsrsState: nextCard.state,
          fsrsStability: nextCard.stability,
          fsrsDifficulty: nextCard.difficulty,
          fsrsElapsedDays: nextCard.elapsed_days,
          fsrsScheduledDays: nextCard.scheduled_days,
          fsrsLearningSteps: nextCard.learning_steps,
          fsrsReps: nextCard.reps,
          fsrsLapses: nextCard.lapses,
          reviewRating: rating,
          reviewIntervalMinutes: intervalMinutes,
          updatedAt: now,
        },
      },
    )

    await reviewLogsCol.insertOne({
      deckId: card.deckId,
      itemType: "flashcard",
      itemId: _id,
      rating: mapRatingToLabel(fsrsRating),
      state: mapStateToLabel(log.state),
      dueAt: log.due,
      nextDueAt: nextCard.due,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      scheduledDays: log.scheduled_days,
      learningSteps: log.learning_steps,
      reps: nextCard.reps,
      lapses: nextCard.lapses,
      reviewedAt: log.review,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      success: true,
      cardId: id,
      next: {
        rating,
        intervalDays,
        intervalMinutes,
        dueAt: nextCard.due,
      },
    })
  } catch (err) {
    console.error("Review error", err)
    return NextResponse.json(
      { error: "Failed to update review schedule" },
      { status: 500 },
    )
  }
}
