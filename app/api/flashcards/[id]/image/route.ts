import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getFlashcardsCollection, ObjectId } from "@/lib/mongodb"
import { uploadMediaFile } from "@/lib/media"

export const runtime = "nodejs"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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

    const ownerId =
      "id" in session.user && typeof session.user.id === "string"
        ? session.user.id
        : undefined
    const { media } = await uploadMediaFile(file, { kind: "image", ownerId })
    const imageUrl = media.url

    const flashcardsCol = await getFlashcardsCollection()
    const _id = new ObjectId(id)

    await flashcardsCol.updateOne(
      { _id },
      {
        $set: {
          ...(side === "front"
            ? { frontImage: imageUrl }
            : { backImage: imageUrl }),
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
