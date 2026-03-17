// app/api/profile/password/route.ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getUsersCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => ({}))
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : ""
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : ""

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới" },
        { status: 400 },
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải từ 6 ký tự trở lên" },
        { status: 400 },
      )
    }

    const usersCol = await getUsersCollection()
    const user = await usersCol.findOne({ _id: new ObjectId(userId) })

    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy người dùng" },
        { status: 404 },
      )
    }

    if (!user.password) {
      return NextResponse.json(
        { error: "Tài khoản này không sử dụng mật khẩu (đăng nhập bằng OAuth)" },
        { status: 400 },
      )
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return NextResponse.json(
        { error: "Mật khẩu hiện tại không đúng" },
        { status: 401 },
      )
    }

    const hashed = await bcrypt.hash(newPassword, 10)

    await usersCol.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashed, updatedAt: new Date() } },
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error changing password", error)
    return NextResponse.json(
      { error: "Không thể đổi mật khẩu" },
      { status: 500 },
    )
  }
}
