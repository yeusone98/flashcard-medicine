// app/api/review-logs/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getReviewLogsCollection, getDecksCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult

    const deckId = req.nextUrl.searchParams.get("deckId")
    if (!deckId || !ObjectId.isValid(deckId)) {
      return NextResponse.json(
        { error: "Thiếu hoặc sai deckId" },
        { status: 400 },
      )
    }

    const itemType = req.nextUrl.searchParams.get("itemType")
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 50)
    const pageRaw = Number(req.nextUrl.searchParams.get("page") ?? 1)

    const limit = Math.min(Math.max(1, limitRaw), 200)
    const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1)
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = {
      deckId: new ObjectId(deckId),
    }

    // Verify deck ownership
    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne({ _id: new ObjectId(deckId), userId: new ObjectId(authResult.userId) })
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    if (itemType === "flashcard" || itemType === "question") {
      filter.itemType = itemType
    }

    const reviewLogsCol = await getReviewLogsCollection()

    const [items, total] = await Promise.all([
      reviewLogsCol
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      reviewLogsCol.countDocuments(filter),
    ])

    const data = items.map((log) => ({
      _id: log._id?.toString(),
      deckId: log.deckId.toString(),
      itemType: log.itemType,
      itemId: log.itemId.toString(),
      rating: log.rating,
      state: log.state,
      dueAt: log.dueAt,
      nextDueAt: log.nextDueAt,
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsedDays,
      scheduledDays: log.scheduledDays,
      reps: log.reps,
      lapses: log.lapses,
      reviewedAt: log.reviewedAt,
      createdAt: log.createdAt,
    }))

    return NextResponse.json({ items: data, total, page, limit })
  } catch (error) {
    console.error("Error fetching review logs", error)
    return NextResponse.json(
      { error: "Không thể tải lịch sử ôn tập" },
      { status: 500 },
    )
  }
}
