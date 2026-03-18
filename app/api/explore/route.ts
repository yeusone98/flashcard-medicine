// app/api/explore/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  getUsersCollection,
} from "@/lib/mongodb"
import { getActiveDeckFilter } from "@/lib/decks"

export const runtime = "nodejs"

// GET — list tất cả deck public (không cần auth)
export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get("search")?.trim() ?? ""
    const subject = req.nextUrl.searchParams.get("subject")?.trim() ?? ""
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 24)
    const pageRaw = Number(req.nextUrl.searchParams.get("page") ?? 1)
    const limit = Math.min(Math.max(1, limitRaw), 50)
    const page = Math.max(1, pageRaw)
    const skip = (page - 1) * limit

    const [decksCol, flashcardsCol, questionsCol, usersCol] = await Promise.all([
      getDecksCollection(),
      getFlashcardsCollection(),
      getQuestionsCollection(),
      getUsersCollection(),
    ])

    // Build filter
    const filter = getActiveDeckFilter({ isPublic: true })
    if (search) {
      filter.$and?.push({ name: { $regex: search, $options: "i" } })
    }
    if (subject) {
      filter.$and?.push({ subject })
    }

    const [decks, total] = await Promise.all([
      decksCol.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
      decksCol.countDocuments(filter),
    ])

    if (decks.length === 0) {
      const subjects = (await decksCol.distinct("subject", getActiveDeckFilter({ isPublic: true }))).filter(Boolean) as string[]
      return NextResponse.json({ decks: [], total, page, limit, subjects })
    }

    // Count flashcards/questions và lấy tên owner
    const deckIds = decks.map((d) => d._id!)
    const userIds = Array.from(new Set(decks.map((d) => d.userId.toString()))).map(
      (id) => decks.find((d) => d.userId.toString() === id)!.userId
    )

    const [flashAgg, qAgg, users] = await Promise.all([
      flashcardsCol
        .aggregate<{ _id: string; count: number }>([
          { $match: { deckId: { $in: deckIds } } },
          { $group: { _id: { $toString: "$deckId" }, count: { $sum: 1 } } },
        ])
        .toArray(),
      questionsCol
        .aggregate<{ _id: string; count: number }>([
          { $match: { deckId: { $in: deckIds } } },
          { $group: { _id: { $toString: "$deckId" }, count: { $sum: 1 } } },
        ])
        .toArray(),
      usersCol.find({ _id: { $in: userIds } }, { projection: { name: 1, email: 1 } }).toArray(),
    ])

    const flashMap = new Map(flashAgg.map((r) => [r._id, r.count]))
    const qMap = new Map(qAgg.map((r) => [r._id, r.count]))
    const userMap = new Map(users.map((u) => [u._id!.toString(), u.name ?? u.email ?? "Ẩn danh"]))

    const result = decks.map((d) => ({
      id: d._id!.toString(),
      name: d.name,
      description: d.description ?? "",
      subject: d.subject ?? "",
      shareToken: d.shareToken,
      flashcardCount: flashMap.get(d._id!.toString()) ?? 0,
      questionCount: qMap.get(d._id!.toString()) ?? 0,
      ownerName: userMap.get(d.userId.toString()) ?? "Ẩn danh",
      updatedAt: d.updatedAt,
    }))

    // Distinct subjects for filter UI
    const subjects = (await decksCol.distinct("subject", getActiveDeckFilter({ isPublic: true }))).filter(Boolean)

    return NextResponse.json({ decks: result, total, page, limit, subjects })
  } catch (err) {
    console.error("Error fetching explore", err)
    return NextResponse.json({ error: "Không thể tải danh sách deck" }, { status: 500 })
  }
}
