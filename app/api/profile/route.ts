// app/api/profile/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getUsersCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"

export async function GET() {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const usersCol = await getUsersCollection()
  const user = await usersCol.findOne(
    { _id: new ObjectId(userId) },
    { projection: { password: 0 } },
  )

  if (!user) {
    return NextResponse.json(
      { error: "Không tìm thấy người dùng" },
      { status: 404 },
    )
  }

  return NextResponse.json({
    _id: user._id.toString(),
    name: user.name ?? null,
    email: user.email,
    image: user.image ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  })
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => ({}))
    const update: Record<string, unknown> = {}

    if (typeof body.name === "string") {
      update.name = body.name.trim() || null
    }

    if (typeof body.email === "string") {
      const email = body.email.toLowerCase().trim()
      if (!email) {
        return NextResponse.json(
          { error: "Email không được để trống" },
          { status: 400 },
        )
      }

      const usersCol = await getUsersCollection()
      const duplicate = await usersCol.findOne({
        _id: { $ne: new ObjectId(userId) },
        email,
      })

      if (duplicate) {
        return NextResponse.json(
          { error: "Email đã được sử dụng" },
          { status: 409 },
        )
      }

      update.email = email
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "Không có thông tin cần cập nhật" },
        { status: 400 },
      )
    }

    update.updatedAt = new Date()

    const usersCol = await getUsersCollection()
    await usersCol.updateOne(
      { _id: new ObjectId(userId) },
      { $set: update },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating profile", error)
    return NextResponse.json(
      { error: "Không thể cập nhật hồ sơ" },
      { status: 500 },
    )
  }
}
