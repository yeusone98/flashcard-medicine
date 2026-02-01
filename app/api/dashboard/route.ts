// app/api/dashboard/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  getMcqResultsCollection,
  ObjectId,
} from "@/lib/mongodb"

export const runtime = "nodejs"

type DeckLite = {
  _id: ObjectId
  name?: string
  description?: string
  subject?: string
}

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    const [decksCol, flashcardsCol, questionsCol, mcqResultsCol] =
      await Promise.all([
        getDecksCollection(),
        getFlashcardsCollection(),
        getQuestionsCollection(),
        getMcqResultsCollection(),
      ])

    const decks = (await decksCol
      .find(
        {},
        {
          projection: {
            name: 1,
            description: 1,
            subject: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ createdAt: -1 })
      .toArray()) as DeckLite[]

    const deckIds = decks.map((deck) => deck._id)
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)

    const dueExpr = { $lte: [{ $ifNull: ["$dueAt", now] }, now] }

    const [flashAgg, questionAgg, mcqAgg] = await Promise.all([
      flashcardsCol
        .aggregate([
          { $match: { deckId: { $in: deckIds } } },
          {
            $group: {
              _id: "$deckId",
              total: { $sum: 1 },
              due: { $sum: { $cond: [dueExpr, 1, 0] } },
              lastReviewedAt: { $max: "$lastReviewedAt" },
            },
          },
        ])
        .toArray(),
      questionsCol
        .aggregate([
          { $match: { deckId: { $in: deckIds } } },
          {
            $group: {
              _id: "$deckId",
              total: { $sum: 1 },
              due: { $sum: { $cond: [dueExpr, 1, 0] } },
              lastReviewedAt: { $max: "$lastReviewedAt" },
            },
          },
        ])
        .toArray(),
      mcqResultsCol
        .aggregate([
          { $match: { deckId: { $in: deckIds } } },
          { $sort: { updatedAt: -1 } },
          {
            $group: {
              _id: "$deckId",
              score10: { $first: "$score10" },
              percent: { $first: "$percent" },
              updatedAt: { $first: "$updatedAt" },
            },
          },
        ])
        .toArray(),
    ])

    const flashMap = new Map<string, any>(
      flashAgg.map((item) => [item._id.toString(), item]),
    )
    const questionMap = new Map<string, any>(
      questionAgg.map((item) => [item._id.toString(), item]),
    )
    const mcqMap = new Map<string, any>(
      mcqAgg.map((item) => [item._id.toString(), item]),
    )

    const decksSummary = decks.map((deck) => {
      const id = deck._id.toString()
      const flash = flashMap.get(id)
      const question = questionMap.get(id)
      const mcq = mcqMap.get(id)

      const lastFlash = flash?.lastReviewedAt instanceof Date ? flash.lastReviewedAt : null
      const lastQuestion =
        question?.lastReviewedAt instanceof Date ? question.lastReviewedAt : null
      const lastReviewedAt =
        lastFlash && lastQuestion
          ? lastFlash > lastQuestion
            ? lastFlash
            : lastQuestion
          : lastFlash ?? lastQuestion ?? null

      return {
        _id: id,
        name: deck.name ?? "Deck",
        subject: deck.subject ?? "",
        totalFlashcards: flash?.total ?? 0,
        dueFlashcards: flash?.due ?? 0,
        totalQuestions: question?.total ?? 0,
        dueQuestions: question?.due ?? 0,
        lastReviewedAt: lastReviewedAt ? lastReviewedAt.toISOString() : null,
        lastMcqScore10:
          typeof mcq?.score10 === "number" ? mcq.score10 : null,
        lastMcqPercent:
          typeof mcq?.percent === "number" ? mcq.percent : null,
        lastMcqAt:
          mcq?.updatedAt instanceof Date ? mcq.updatedAt.toISOString() : null,
      }
    })

    const [
      totalFlashcards,
      totalQuestions,
      dueFlashcards,
      dueQuestions,
      reviewedFlashcardsToday,
      reviewedQuestionsToday,
    ] = await Promise.all([
      flashcardsCol.countDocuments({ deckId: { $in: deckIds } }),
      questionsCol.countDocuments({ deckId: { $in: deckIds } }),
      flashcardsCol.countDocuments({
        deckId: { $in: deckIds },
        $or: [
          { dueAt: { $exists: false } },
          { dueAt: null },
          { dueAt: { $lte: now } },
        ],
      }),
      questionsCol.countDocuments({
        deckId: { $in: deckIds },
        $or: [
          { dueAt: { $exists: false } },
          { dueAt: null },
          { dueAt: { $lte: now } },
        ],
      }),
      flashcardsCol.countDocuments({ lastReviewedAt: { $gte: startOfDay } }),
      questionsCol.countDocuments({ lastReviewedAt: { $gte: startOfDay } }),
    ])

    return NextResponse.json({
      summary: {
        totalDecks: decks.length,
        totalFlashcards,
        totalQuestions,
        dueFlashcards,
        dueQuestions,
        reviewedFlashcardsToday,
        reviewedQuestionsToday,
      },
      decks: decksSummary,
    })
  } catch (error) {
    console.error("[DASHBOARD][GET] error", error)
    return NextResponse.json(
      { error: "Không thể tải dashboard" },
      { status: 500 },
    )
  }
}
