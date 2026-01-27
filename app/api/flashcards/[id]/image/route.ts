import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, ObjectId } from "@/lib/mongodb"
import cloudinary from "@/lib/cloudinary"

export const runtime = "nodejs"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "flashcardId không hợp lệ" },
        { status: 400 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const side = String(formData.get("side") ?? "").toLowerCase()

    if (!file) {
      return NextResponse.json(
        { error: "Không có file được upload" },
        { status: 400 },
      )
    }

    if (side !== "front" && side !== "back") {
      return NextResponse.json(
        { error: "Thiếu hoặc sai side (front/back)" },
        { status: 400 },
      )
    }

    const maxSize = 4 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Ảnh quá lớn (tối đa 4MB)" },
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
    const mimeType = file.type || "image/png"
    const base64 = buffer.toString("base64")
    const dataUri = `data:${mimeType};base64,${base64}`

    const folder =
      process.env.CLOUDINARY_FOLDER || "flashcard-medicine/flashcards"

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: `${id}-${side}`,
      overwrite: true,
      invalidate: true,
    })

    const imageUrl = uploadResult.secure_url

    const flashcardsCol = await getFlashcardsCollection()
    const _id = new ObjectId(id)

    await flashcardsCol.updateOne(
      { _id },
      {
        $set: {
          ...(side === "front"
            ? { frontImageUrl: imageUrl }
            : { backImageUrl: imageUrl }),
          updatedAt: new Date(),
        },
      },
    )

    return NextResponse.json({ ok: true, imageUrl, side })
  } catch (error) {
    console.error("Upload flashcard image error", error)
    return NextResponse.json(
      { error: "Không thể upload ảnh flashcard" },
      { status: 500 },
    )
  }
}
