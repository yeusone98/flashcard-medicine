import { mediaIsReferenced } from "@/lib/media-references"
// app/api/media/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { getMediaCollection, ObjectId } from "@/lib/mongodb"
import { getUserIdFromSession } from "@/lib/auth-helpers"
import cloudinary from "@/lib/cloudinary"

export const runtime = "nodejs"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID không hợp lệ" },
        { status: 400 },
      )
    }

    const mediaCol = await getMediaCollection()
    const media = await mediaCol.findOne({ _id: new ObjectId(id), ownerId: new ObjectId(userId) })

    if (!media) {
      return NextResponse.json(
        { error: "Không tìm thấy media" },
        { status: 404 },
      )
    }

    if (await mediaIsReferenced(media)) return NextResponse.json({ error: "File đang được sử dụng trong thẻ, ghi chú hoặc hồ sơ. Hãy gỡ liên kết trước khi xoá." }, { status: 409 })

    // Xoá trên Cloudinary nếu có publicId
    if (media.publicId) {
      try {
        await cloudinary.uploader.destroy(media.publicId, {
          resource_type: media.resourceType ?? "image",
          invalidate: true,
        })
      } catch (err) {
        console.error("Cloudinary delete error", err)
        return NextResponse.json({ error: "Không thể xoá file. Vui lòng thử lại." }, { status: 502 })
      }
    }

    await mediaCol.deleteOne({ _id: new ObjectId(id) })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting media", error)
    return NextResponse.json(
      { error: "Không thể xoá media" },
      { status: 500 },
    )
  }
}
