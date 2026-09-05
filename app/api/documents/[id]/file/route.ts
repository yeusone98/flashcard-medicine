import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { documentError, ownedDocument, readPdfChunk } from "@/lib/documents"
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const doc = await ownedDocument((await ctx.params).id, auth.userId)
  if (!doc || doc.status !== "ready") return documentError("Không tìm thấy PDF.", 404)
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0)
  if (!Number.isInteger(offset) || offset < 0 || offset >= doc.bytes) return documentError("Vị trí đọc không hợp lệ.", 400)
  try {
    const data = await readPdfChunk(doc, offset, Math.min(1024 * 1024, doc.bytes - offset))
    if (!data.length) return documentError("Không tải được nội dung PDF.", 502)
    return new Response(data as BodyInit, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
  } catch { return documentError("Không tải được PDF. Kiểm tra cấu hình tải PDF của Cloudinary hoặc thử lại.", 502) }
}
