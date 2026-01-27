// app/api/questions/[id]/review/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getQuestionsCollection, ObjectId } from "@/lib/mongodb"
import { applySm2, ratingToGrade, type ReviewRating } from "@/lib/srs"

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

    const questionsCol = await getQuestionsCollection()
    const _id = new ObjectId(id)

    const question = await questionsCol.findOne({ _id })
    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      )
    }

    const now = new Date()
    const grade = ratingToGrade(rating)

    const next = applySm2(
      {
        repetitions: question.sm2Repetitions ?? 0,
        interval: question.sm2Interval ?? 0,
        easiness: question.sm2Easiness ?? 2.5,
      },
      grade,
      now,
    )

    const intervalMinutes = next.interval * 24 * 60

    await questionsCol.updateOne(
      { _id },
      {
        $set: {
          lastReviewedAt: now,
          dueAt: next.dueAt,
          sm2Repetitions: next.repetitions,
          sm2Interval: next.interval,
          sm2Easiness: next.easiness,
          reviewRating: rating,
          reviewIntervalMinutes: intervalMinutes,
          updatedAt: now,
        },
      },
    )

    return NextResponse.json({
      success: true,
      questionId: id,
      next: {
        rating,
        intervalDays: next.interval,
        intervalMinutes,
        easiness: next.easiness,
        dueAt: next.dueAt,
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
