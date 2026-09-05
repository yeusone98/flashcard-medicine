import type { ClientSession } from "mongodb"
import { getDb, ObjectId, type FlashcardDoc, type QuestionDoc, type ReviewLogDoc } from "@/lib/mongodb"
import { buildFsrsCard, mapReviewRating, mapRatingToLabel, mapStateToLabel, scheduleFsrsReview, type DeckOptions } from "@/lib/fsrs"

export type ReviewRating = "again" | "hard" | "good" | "easy"
export const ratings: ReviewRating[] = ["again", "hard", "good", "easy"]

export async function saveReview(input: {
  itemType: "flashcard" | "question"
  item: (FlashcardDoc | QuestionDoc) & { _id: ObjectId }
  rating: ReviewRating
  requestId: string
  options: DeckOptions
  session: ClientSession
}) {
  const { itemType, item, rating, requestId, options, session } = input
  const db = await getDb()
  const logs = db.collection<ReviewLogDoc & { requestId?: string; nextIntervalDays?: number }>("review_logs")
  const prior = await logs.findOne({ itemId: item._id, requestId }, { session })
  if (prior) return { rating: prior.rating, dueAt: prior.nextDueAt, intervalMinutes: Math.max(1, Math.round((prior.nextDueAt!.getTime() - prior.reviewedAt.getTime()) / 60000)), intervalDays: prior.nextIntervalDays ?? prior.scheduledDays }
  const now = new Date()
  const result = scheduleFsrsReview(buildFsrsCard(item, now), mapReviewRating(rating), now, options)
  const c = result.card
  const log = result.log
  const intervalMinutes = Math.max(1, Math.round((c.due.getTime() - now.getTime()) / 60000))
  await db.collection(itemType === "flashcard" ? "flashcards" : "questions").updateOne({ _id: item._id }, { $set: {
    lastReviewedAt: now, dueAt: c.due, fsrsState: c.state, fsrsStability: c.stability,
    fsrsDifficulty: c.difficulty, fsrsElapsedDays: c.elapsed_days, fsrsScheduledDays: c.scheduled_days,
    fsrsLearningSteps: c.learning_steps, fsrsReps: c.reps, fsrsLapses: c.lapses,
    reviewRating: rating, reviewIntervalMinutes: intervalMinutes, updatedAt: now,
  } }, { session })
  await logs.insertOne({
    deckId: item.deckId, itemType, itemId: item._id, requestId, nextIntervalDays: c.scheduled_days,
    rating: mapRatingToLabel(mapReviewRating(rating)), state: mapStateToLabel(log.state),
    dueAt: log.due, nextDueAt: c.due, stability: log.stability, difficulty: log.difficulty,
    elapsedDays: log.elapsed_days, scheduledDays: log.scheduled_days, learningSteps: log.learning_steps,
    reps: c.reps, lapses: c.lapses, reviewedAt: log.review, createdAt: now, updatedAt: now,
  }, { session })
  return { rating, dueAt: c.due, intervalMinutes, intervalDays: c.scheduled_days }
}
