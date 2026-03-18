// app/api/deck-parents/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDeckParentsCollection,
  getDecksCollection,
  ObjectId,
} from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { getOwnedActiveDeckFilter } from "@/lib/decks"

export const runtime = "nodejs"

export async function GET() {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const [decksCol, parentsCol] = await Promise.all([
      getDecksCollection(),
      getDeckParentsCollection(),
    ])

    const rawSubjects = (await decksCol.distinct("subject", getOwnedActiveDeckFilter(userId))) as (
      | string
      | null
    )[]

    const storedParents = await parentsCol
      .find({ userId: new ObjectId(userId) }, { projection: { name: 1 } })
      .toArray()

    const merged = [
      ...rawSubjects,
      ...storedParents.map((p) => p?.name ?? null),
    ]

    const parents = merged
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .filter((value, index, arr) =>
        arr.findIndex((v) => v.toLowerCase() === value.toLowerCase()) === index,
      )
      .sort((a, b) => a.localeCompare(b, "vi"))

    return NextResponse.json({ parents })
  } catch (error) {
    console.error("Error in /api/deck-parents", error)
    return NextResponse.json(
      { error: "Không lấy được danh sách môn học" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => ({}))
    const nameRaw = typeof body?.name === "string" ? body.name : ""
    const name = nameRaw.trim()

    if (!name) {
      return NextResponse.json(
        { error: "Thiếu tên môn học" },
        { status: 400 },
      )
    }

    const parentsCol = await getDeckParentsCollection()

    const escapeRegex = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    const existing = await parentsCol.findOne({
      userId: new ObjectId(userId),
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    })

    if (existing?._id) {
      return NextResponse.json(
        { error: "Môn học đã tồn tại" },
        { status: 409 },
      )
    }

    const now = new Date()
    const insert = await parentsCol.insertOne({
      userId: new ObjectId(userId),
      name,
      createdAt: now,
      updatedAt: now,
    })

    return NextResponse.json({
      id: insert.insertedId.toString(),
      name,
    })
  } catch (error) {
    console.error("Error creating deck parent", error)
    return NextResponse.json(
      { error: "Không thể tạo môn học" },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => ({}))
    const oldName = typeof body?.oldName === "string" ? body.oldName.trim() : ""
    const newName = typeof body?.newName === "string" ? body.newName.trim() : ""

    if (!oldName || !newName) {
      return NextResponse.json({ error: "Thiếu thông tin tên" }, { status: 400 })
    }

    if (oldName.toLowerCase() === newName.toLowerCase()) {
      return NextResponse.json({ success: true })
    }

    const [decksCol, parentsCol] = await Promise.all([
      getDecksCollection(),
      getDeckParentsCollection(),
    ])

    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    // Check if newName already exists (conflict)
    const duplicate = await parentsCol.findOne({
      userId: new ObjectId(userId),
      name: { $regex: `^${escapeRegex(newName)}$`, $options: "i" },
    })

    if (duplicate) {
      // If it exists but we're just merging, we might not want to throw an error, 
      // but for simplicity, we treat rename to an existing subject as a conflict.
      return NextResponse.json({ error: "Tên môn học mới đã tồn tại" }, { status: 409 })
    }

    // Update in parents collection
    await parentsCol.updateOne(
      { userId: new ObjectId(userId), name: { $regex: `^${escapeRegex(oldName)}$`, $options: "i" } },
      { $set: { name: newName, updatedAt: new Date() } }
    )

    // Update in decks collection
    await decksCol.updateMany(
      { userId: new ObjectId(userId), subject: oldName },
      { $set: { subject: newName, updatedAt: new Date() } }
    )

    return NextResponse.json({ success: true, newName })
  } catch (error) {
    console.error("Error renaming deck parent", error)
    return NextResponse.json({ error: "Không thể đổi tên môn học" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === "string" ? body.name.trim() : ""

    if (!name) {
      return NextResponse.json({ error: "Thiếu tên môn học" }, { status: 400 })
    }

    const [decksCol, parentsCol] = await Promise.all([
      getDecksCollection(),
      getDeckParentsCollection(),
    ])

    // Safety: check if there are decks in this subject
    const deckCount = await decksCol.countDocuments(
      getOwnedActiveDeckFilter(userId, { subject: name }),
    )
    if (deckCount > 0) {
      return NextResponse.json(
        { error: "Không thể xóa môn học đang chứa bộ thẻ. Hãy chuyển hoặc xóa các bộ thẻ trước." },
        { status: 400 }
      )
    }

    const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const result = await parentsCol.deleteOne({
      userId: new ObjectId(userId),
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" }
    })

    if (result.deletedCount === 0) {
      // It might be an implicit subject (only exists in decks, but we just verified deckCount === 0)
      // So nothing to delete, but we return success anyway since the goal is achieved.
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting deck parent", error)
    return NextResponse.json({ error: "Không thể xóa môn học" }, { status: 500 })
  }
}
