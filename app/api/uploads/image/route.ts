import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { uploadMediaFile } from "@/lib/media"

export const runtime = "nodejs"

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

    const ownerId =
      "id" in session.user && typeof session.user.id === "string"
        ? session.user.id
        : undefined
    const { media } = await uploadMediaFile(file, { kind: "image", ownerId })

    return NextResponse.json({ url: media.url })
  } catch (error) {
    console.error("Upload image error", error)
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 },
    )
  }
}
