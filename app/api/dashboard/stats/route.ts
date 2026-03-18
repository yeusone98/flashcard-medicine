import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { getReviewLogsCollection, getDecksCollection, ObjectId } from "@/lib/mongodb"

export async function GET() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const reviewLogsCol = await getReviewLogsCollection()
  const decksCol = await getDecksCollection()

  // Get all user's deck IDs
  const userDecks = await decksCol
    .find({ userId: new ObjectId(userId) }, { projection: { _id: 1 } })
    .toArray()
  const deckIds = userDecks.map((d) => d._id)

  if (deckIds.length === 0) {
    return NextResponse.json({
      dailyReviews: [],
      ratingBreakdown: [],
      streak: 0,
      totalReviews: 0,
      hardestCards: [],
    })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  thirtyDaysAgo.setHours(0, 0, 0, 0)

  // 1. Daily reviews (last 30 days)
  const dailyPipeline = [
    {
      $match: {
        deckId: { $in: deckIds },
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 as const } },
  ]

  // 2. Rating breakdown
  const ratingPipeline = [
    {
      $match: {
        deckId: { $in: deckIds },
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ]

  // 3. Hardest cards (most "again" ratings)
  const hardestPipeline = [
    {
      $match: {
        deckId: { $in: deckIds },
        rating: "again",
      },
    },
    {
      $group: {
        _id: "$itemId",
        againCount: { $sum: 1 },
      },
    },
    { $sort: { againCount: -1 as const } },
    { $limit: 5 },
  ]

  // 4. Streak calculation — count consecutive days with reviews
  const streakPipeline = [
    {
      $match: { deckId: { $in: deckIds } },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
        },
      },
    },
    { $sort: { _id: -1 as const } },
  ]

  const [dailyReviews, ratingBreakdown, hardestCards, streakDays] =
    await Promise.all([
      reviewLogsCol.aggregate(dailyPipeline).toArray(),
      reviewLogsCol.aggregate(ratingPipeline).toArray(),
      reviewLogsCol.aggregate(hardestPipeline).toArray(),
      reviewLogsCol.aggregate(streakPipeline).toArray(),
    ])

  // Calculate streak
  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daySet = new Set(streakDays.map((d) => d._id as string))

  // Check if today or yesterday has reviews (allow checking from today)
  const checkDate = new Date(today)
  const todayStr = checkDate.toISOString().split("T")[0]
  if (!daySet.has(todayStr)) {
    // If no review today, check if yesterday had one to start streak from there
    checkDate.setDate(checkDate.getDate() - 1)
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split("T")[0]
    if (daySet.has(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  // Total reviews
  const totalReviews = await reviewLogsCol.countDocuments({
    deckId: { $in: deckIds },
  })

  return NextResponse.json({
    dailyReviews: dailyReviews.map((d) => ({
      date: d._id,
      count: d.count,
    })),
    ratingBreakdown: ratingBreakdown.map((r) => ({
      rating: r._id ?? "unknown",
      count: r.count,
    })),
    hardestCards: hardestCards.map((h) => ({
      itemId: h._id?.toString() ?? "",
      againCount: h.againCount,
    })),
    streak,
    totalReviews,
  })
}
