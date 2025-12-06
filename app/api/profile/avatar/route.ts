// app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getUsersCollection, ObjectId } from "@/lib/mongodb"
import cloudinary from "@/lib/cloudinary"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    try {
        const session = await auth()

        // ✅ Không dùng any, dùng type guard thuần TypeScript
        const userId =
            session?.user &&
            "id" in session.user &&
            typeof session.user.id === "string"
                ? session.user.id
                : undefined

        if (!userId) {
            return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
        }

        const formData = await req.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json(
                { error: "Không có file được upload" },
                { status: 400 },
            )
        }

        // Giới hạn 2MB
        const maxSize = 2 * 1024 * 1024
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: "Ảnh quá lớn (tối đa 2MB)" },
                { status: 400 },
            )
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json(
                { error: "File phải là hình ảnh" },
                { status: 400 },
            )
        }

        // Đọc file thành buffer
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const mimeType = file.type || "image/png"
        const base64 = buffer.toString("base64")
        const dataUri = `data:${mimeType};base64,${base64}`

        const folder =
            process.env.CLOUDINARY_FOLDER || "flashcard-medicine/avatars"

        // Upload lên Cloudinary
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
            folder,
            public_id: userId, // mỗi user 1 avatar, upload mới sẽ overwrite
            overwrite: true,
            invalidate: true,
        })

        const imageUrl = uploadResult.secure_url

        const users = await getUsersCollection()

        // Cập nhật URL avatar mới vào DB
        await users.updateOne(
            { _id: new ObjectId(userId) },
            {
                $set: {
                    image: imageUrl,
                    updatedAt: new Date(),
                },
            },
        )

        return NextResponse.json({ ok: true, imageUrl })
    } catch (err) {
        console.error("Upload avatar error", err)
        return NextResponse.json(
            { error: "Không thể upload avatar" },
            { status: 500 },
        )
    }
}
