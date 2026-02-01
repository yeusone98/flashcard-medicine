import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"
import { uploadMediaFile, type MediaKind } from "@/lib/media"

export const runtime = "nodejs"

function getUserIdFromSession(session: Session | null): string | undefined {
  if (!session?.user) return undefined
  if ("id" in session.user && typeof session.user.id === "string") {
    return session.user.id
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const kindRaw =
      (formData.get("kind") as string | null) ??
      req.nextUrl.searchParams.get("kind")

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 })
    }

    const kind =
      kindRaw === "image" || kindRaw === "audio"
        ? (kindRaw as MediaKind)
        : undefined

    const { media, reused } = await uploadMediaFile(file, {
      kind,
      ownerId: userId,
    })

    return NextResponse.json({
      reused,
      media: {
        id: media._id.toString(),
        url: media.url,
        kind: media.kind,
        resourceType: media.resourceType,
        format: media.format,
        bytes: media.bytes,
        width: media.width,
        height: media.height,
        duration: media.duration,
        createdAt: media.createdAt,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
