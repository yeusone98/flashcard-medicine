// app/api/register/route.ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getUsersCollection } from "@/lib/mongodb"

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        let { name, email, password } = body as {
            name?: string
            email?: string
            password?: string
        }

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email và mật khẩu là bắt buộc" },
                { status: 400 },
            )
        }

        email = email.toLowerCase().trim()
        if (password.length < 6) {
            return NextResponse.json(
                { error: "Mật khẩu phải từ 6 ký tự trở lên" },
                { status: 400 },
            )
        }

        const users = await getUsersCollection()

        const existing = await users.findOne({ email })
        if (existing) {
            return NextResponse.json(
                { error: "Email này đã được đăng ký" },
                { status: 400 },
            )
        }

        const hashed = await bcrypt.hash(password, 10)

        await users.insertOne({
            name: name?.trim() || null,
            email,
            password: hashed,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        return NextResponse.json({ ok: true }, { status: 201 })
    } catch (err) {
        console.error("Register error", err)
        return NextResponse.json(
            { error: "Có lỗi xảy ra, vui lòng thử lại" },
            { status: 500 },
        )
    }
}
