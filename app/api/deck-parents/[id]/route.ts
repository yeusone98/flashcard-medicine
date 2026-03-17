// app/api/deck-parents/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDeckParentsCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const { id } = await params

  if (!ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "ID không hợp lệ" },
      { status: 400 },
    )
  }

  const parentsCol = await getDeckParentsCollection()
  const parent = await parentsCol.findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) })

  if (!parent) {
    return NextResponse.json(
      { error: "Không tìm thấy môn học" },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ...parent,
    _id: parent._id?.toString(),
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID không hợp lệ" },
        { status: 400 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const rawName = typeof body?.name === "string" ? body.name : ""
    const name = rawName.trim()

    if (!name) {
      return NextResponse.json(
        { error: "Tên môn học không được để trống" },
        { status: 400 },
      )
    }

    const parentsCol = await getDeckParentsCollection()
    const parentId = new ObjectId(id)

    const existing = await parentsCol.findOne({ _id: parentId, userId: new ObjectId(userId) })
    if (!existing) {
      return NextResponse.json(
        { error: "Không tìm thấy môn học" },
        { status: 404 },
      )
    }

    // Kiểm tra trùng tên (case-insensitive), bỏ qua chính nó
    const escapeRegex = (value: string) =>
      value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

    const duplicate = await parentsCol.findOne({
      _id: { $ne: parentId },
      userId: new ObjectId(userId),
      name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: "Tên môn học đã tồn tại" },
        { status: 409 },
      )
    }

    await parentsCol.updateOne(
      { _id: parentId },
      { $set: { name, updatedAt: new Date() } },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating deck parent", error)
    return NextResponse.json(
      { error: "Không thể cập nhật môn học" },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID không hợp lệ" },
        { status: 400 },
      )
    }

    const parentsCol = await getDeckParentsCollection()
    const result = await parentsCol.deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy môn học" },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting deck parent", error)
    return NextResponse.json(
      { error: "Không thể xoá môn học" },
      { status: 500 },
    )
  }
}
