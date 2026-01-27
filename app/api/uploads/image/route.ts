import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import cloudinary from "@/lib/cloudinary"

export const runtime = "nodejs"

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image is too large (max 5MB)" },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const mimeType = file.type || "image/png"
    const base64 = buffer.toString("base64")
    const dataUri = `data:${mimeType};base64,${base64}`

    const baseFolder = process.env.CLOUDINARY_FOLDER || "flashcard-medicine"
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: `${baseFolder}/cards`,
    })

    return NextResponse.json({ url: uploadResult.secure_url })
  } catch (error) {
    console.error("Upload image error", error)
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    )
  }
}
