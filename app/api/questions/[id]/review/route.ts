// app/api/questions/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDecksCollection,
  getQuestionsCollection,
  getReviewLogsCollection,
  ObjectId,
} from "@/lib/mongodb"
import {
  buildFsrsCard,
  mapRatingToLabel,
  mapReviewRating,
  mapStateToLabel,
  normalizeDeckOptions,
  scheduleFsrsReview,
} from "@/lib/fsrs"

type ReviewRating = "again" | "hard" | "good" | "easy"

const allowedRatings: ReviewRating[] = ["again", "hard", "good", "easy"]

function resolveRating(body: any): ReviewRating | null {
  const ratingRaw = typeof body?.rating === "string" ? body.rating : ""
  if (allowedRatings.includes(ratingRaw as ReviewRating)) {
    return ratingRaw as ReviewRating
  }

  if (typeof body?.isCorrect === "boolean") {
    return body.isCorrect ? "good" : "again"
  }

  return null
}

export async function POST(
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
    const rating = resolveRating(body)

    if (!rating) {
      return NextResponse.json(
        { error: "rating must be 'again' | 'hard' | 'good' | 'easy' or provide isCorrect" },
        { status: 400 },
      )
    }

    const [questionsCol, decksCol, reviewLogsCol] = await Promise.all([
      getQuestionsCollection(),
      getDecksCollection(),
      getReviewLogsCollection(),
    ])
    const _id = new ObjectId(id)

    const question = await questionsCol.findOne({ _id })
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      )
    }

    const deck = await decksCol.findOne({ _id: question.deckId })
    const deckOptions = normalizeDeckOptions(deck?.options ?? null)

    const now = new Date()
    const fsrsCard = buildFsrsCard(question, now)
    const fsrsRating = mapReviewRating(rating)

    const result = scheduleFsrsReview(fsrsCard, fsrsRating, now, deckOptions)
    const nextCard = result.card
    const log = result.log

    const intervalMinutes = Math.max(
      1,
      Math.round((nextCard.due.getTime() - now.getTime()) / (60 * 1000)),
    )
    const intervalDays = Math.max(0, Math.round(nextCard.scheduled_days))

    await questionsCol.updateOne(
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
      deckId: question.deckId,
      itemType: "question",
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
      questionId: id,
      next: {
        rating,
        intervalDays,
        intervalMinutes,
        dueAt: nextCard.due,
      },
    })
  } catch (err) {
    console.error("Question review error", err)
    return NextResponse.json(
      { error: "Failed to update review schedule" },
      { status: 500 },
    )
  }
}
