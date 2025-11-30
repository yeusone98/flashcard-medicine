// app/api/profile/avatar/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getUsersCollection, ObjectId } from "@/lib/mongodb"
import { promises as fs } from "fs"
import path from "path"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    try {
        const session = await auth()
        const userId = (session?.user as any)?.id as string | undefined

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

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const uploadDir = path.join(process.cwd(), "public", "avatars")
        await fs.mkdir(uploadDir, { recursive: true })

        // 🔥 Đọc user hiện tại để xoá avatar cũ nếu có
        const users = await getUsersCollection()
        const dbUser = await users.findOne({ _id: new ObjectId(userId) })
        const oldImage = dbUser?.image as string | undefined
        if (oldImage && oldImage.startsWith("/avatars/")) {
            const oldFilename = oldImage.replace("/avatars/", "")
            const oldPath = path.join(uploadDir, oldFilename)
            // best effort – không cần await lỗi
            fs.unlink(oldPath).catch(() => { })
        }

        // 🔥 Tạo tên file mới theo time để tránh cache
        const extFromName = file.name.split(".").pop()
        const ext = extFromName && extFromName.length <= 5 ? extFromName : "png"
        const filename = `${userId}-${Date.now()}.${ext}`
        const filePath = path.join(uploadDir, filename)

        await fs.writeFile(filePath, buffer)

        const imageUrl = `/avatars/${filename}`

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
