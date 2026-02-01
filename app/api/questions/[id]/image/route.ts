import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getQuestionsCollection, ObjectId } from "@/lib/mongodb"
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
        { error: "questionId không hợp lệ" },
        { status: 400 },
      )
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json(
        { error: "Không có file được upload" },
        { status: 400 },
      )
    }

    const ownerId =
      "id" in session.user && typeof session.user.id === "string"
        ? session.user.id
        : undefined
    const { media } = await uploadMediaFile(file, { kind: "image", ownerId })
    const imageUrl = media.url

    const questionsCol = await getQuestionsCollection()
    const _id = new ObjectId(id)

    await questionsCol.updateOne(
      { _id },
      {
        $set: {
          image: imageUrl,
          updatedAt: new Date(),
        },
      },
    )

    return NextResponse.json({ ok: true, imageUrl })
  } catch (error) {
    console.error("Upload question image error", error)
    return NextResponse.json(
      { error: "Không thể upload ảnh câu hỏi" },
      { status: 500 },
    )
  }
}
