import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"
import { getMediaCollection } from "@/lib/mongodb"

export const runtime = "nodejs"

function getUserIdFromSession(session: Session | null): string | undefined {
  if (!session?.user) return undefined
  if ("id" in session.user && typeof session.user.id === "string") {
    return session.user.id
  }
  return undefined
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const type = req.nextUrl.searchParams.get("type") ?? "all"
    const q = req.nextUrl.searchParams.get("q") ?? ""
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 30)
    const pageRaw = Number(req.nextUrl.searchParams.get("page") ?? 1)

    const limit = Math.min(Math.max(1, limitRaw), 100)
    const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1)
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = {}
    if (type === "image" || type === "audio") {
      filter.kind = type
    }
    if (q.trim()) {
      const keyword = q.trim()
      filter.$or = [
        { url: { $regex: keyword, $options: "i" } },
        { publicId: { $regex: keyword, $options: "i" } },
        { format: { $regex: keyword, $options: "i" } },
      ]
    }

    const mediaCol = await getMediaCollection()
    const [items, total] = await Promise.all([
      mediaCol
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      mediaCol.countDocuments(filter),
    ])

    return NextResponse.json({
      items: items.map((item) => ({
        id: item._id?.toString(),
        url: item.url,
        kind: item.kind,
        resourceType: item.resourceType,
        format: item.format,
        bytes: item.bytes,
        width: item.width,
        height: item.height,
        duration: item.duration,
        publicId: item.publicId,
        createdAt: item.createdAt,
      })),
      total,
      page,
      limit,
    })
  } catch (error) {
    console.error("Media list error", error)
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 },
    )
  }
}
