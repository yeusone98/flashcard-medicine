// app/api/deck-parents/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDeckParentsCollection,
  getDecksCollection,
} from "@/lib/mongodb"

export const runtime = "nodejs"

export async function GET() {
  try {
    const [decksCol, parentsCol] = await Promise.all([
      getDecksCollection(),
      getDeckParentsCollection(),
    ])

    const rawSubjects = (await decksCol.distinct("subject")) as (
      | string
      | null
    )[]

    const storedParents = await parentsCol
      .find({}, { projection: { name: 1 } })
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
