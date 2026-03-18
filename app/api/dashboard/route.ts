import { NextResponse } from "next/server"
import { auth } from "@/auth"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  getMcqResultsCollection,
  ObjectId,
} from "@/lib/mongodb"
import { getOwnedActiveDeckFilter } from "@/lib/decks"
import { normalizeDeckOptions } from "@/lib/fsrs"
import { getUserIdFromSession } from "@/lib/auth-helpers"

export const runtime = "nodejs"

type DeckLite = {
  _id: ObjectId
  name?: string
  description?: string
  subject?: string
  options?: unknown
}

type DueAggregateRow = {
  _id: ObjectId
  total?: number
  due?: number
  lastReviewedAt?: Date | null
}

type McqAggregateRow = {
  _id: ObjectId
  score10?: number | null
  percent?: number | null
  updatedAt?: Date | null
}

export async function GET() {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)
    if (!userId) {
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
        getOwnedActiveDeckFilter(userId),
        {
          projection: {
            name: 1,
            description: 1,
            subject: 1,
            options: 1,
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

    const [flashAggRaw, questionAggRaw, mcqAggRaw] = await Promise.all([
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

    const flashAgg = flashAggRaw as DueAggregateRow[]
    const questionAgg = questionAggRaw as DueAggregateRow[]
    const mcqAgg = mcqAggRaw as McqAggregateRow[]

    const flashMap = new Map<string, DueAggregateRow>(
      flashAgg.map((item) => [item._id.toString(), item]),
    )
    const questionMap = new Map<string, DueAggregateRow>(
      questionAgg.map((item) => [item._id.toString(), item]),
    )
    const mcqMap = new Map<string, McqAggregateRow>(
      mcqAgg.map((item) => [item._id.toString(), item]),
    )

    const decksSummary = decks.map((deck) => {
      const id = deck._id.toString()
      const flash = flashMap.get(id)
      const question = questionMap.get(id)
      const mcq = mcqMap.get(id)
      const deckOptions = normalizeDeckOptions(deck.options ?? null)

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
        newPerDayLimit: deckOptions.newPerDay,
        reviewPerDayLimit: deckOptions.reviewPerDay,
        lastReviewedAt: lastReviewedAt ? lastReviewedAt.toISOString() : null,
        lastMcqScore10:
          typeof mcq?.score10 === "number" ? mcq.score10 : null,
        lastMcqPercent:
          typeof mcq?.percent === "number" ? mcq.percent : null,
        lastMcqAt:
          mcq?.updatedAt instanceof Date ? mcq.updatedAt.toISOString() : null,
      }
    })

    type SubjectAggregate = {
      name: string
      isUnassigned: boolean
      deckCount: number
      totalFlashcards: number
      dueFlashcards: number
      totalQuestions: number
      dueQuestions: number
      newPerDayMin: number
      newPerDayMax: number
      reviewPerDayMin: number
      reviewPerDayMax: number
    }

    const subjectMap = new Map<string, SubjectAggregate>()
    for (const deck of decksSummary) {
      const rawSubject =
        typeof deck.subject === "string" ? deck.subject.trim() : ""
      const isUnassigned = rawSubject.length === 0
      const subjectName = isUnassigned ? "Chua gan mon" : rawSubject
      const key = subjectName.toLowerCase()

      const current = subjectMap.get(key)
      if (!current) {
        subjectMap.set(key, {
          name: subjectName,
          isUnassigned,
          deckCount: 1,
          totalFlashcards: deck.totalFlashcards,
          dueFlashcards: deck.dueFlashcards,
          totalQuestions: deck.totalQuestions,
          dueQuestions: deck.dueQuestions,
          newPerDayMin: deck.newPerDayLimit,
          newPerDayMax: deck.newPerDayLimit,
          reviewPerDayMin: deck.reviewPerDayLimit,
          reviewPerDayMax: deck.reviewPerDayLimit,
        })
        continue
      }

      current.deckCount += 1
      current.totalFlashcards += deck.totalFlashcards
      current.dueFlashcards += deck.dueFlashcards
      current.totalQuestions += deck.totalQuestions
      current.dueQuestions += deck.dueQuestions
      current.newPerDayMin = Math.min(current.newPerDayMin, deck.newPerDayLimit)
      current.newPerDayMax = Math.max(current.newPerDayMax, deck.newPerDayLimit)
      current.reviewPerDayMin = Math.min(
        current.reviewPerDayMin,
        deck.reviewPerDayLimit,
      )
      current.reviewPerDayMax = Math.max(
        current.reviewPerDayMax,
        deck.reviewPerDayLimit,
      )
    }

    const subjects = Array.from(subjectMap.values()).sort((a, b) => {
      const dueA = a.dueFlashcards + a.dueQuestions
      const dueB = b.dueFlashcards + b.dueQuestions
      if (dueA !== dueB) return dueB - dueA
      return a.name.localeCompare(b.name, "vi")
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
      flashcardsCol.countDocuments({
        deckId: { $in: deckIds },
        lastReviewedAt: { $gte: startOfDay },
      }),
      questionsCol.countDocuments({
        deckId: { $in: deckIds },
        lastReviewedAt: { $gte: startOfDay },
      }),
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
      subjects,
    })
  } catch (error) {
    console.error("[DASHBOARD][GET] error", error)
    return NextResponse.json(
      { error: "Không thể tải dashboard" },
      { status: 500 },
    )
  }
}
