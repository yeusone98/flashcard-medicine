import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { documentCollection, documentError, documentJson, MAX_PDF_BYTES } from "@/lib/documents"
import { getDb, ObjectId, withTransaction } from "@/lib/mongodb"
import cloudinary from "@/lib/cloudinary"

export async function GET() {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const docs = await (await documentCollection()).find({ userId: auth.userId }).sort({ createdAt: -1 }).toArray()
  return NextResponse.json(docs.map(documentJson), { headers: { "Cache-Control": "private, no-store" } })
}
export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (typeof body?.title !== "string" || !body.title.trim() || body.title.length > 160 || !Number.isInteger(body.bytes) || body.bytes < 5 || body.bytes > MAX_PDF_BYTES || (body.subject !== undefined && (typeof body.subject !== "string" || body.subject.length > 100))) return documentError("Chọn PDF tối đa 10 MB, tên tối đa 160 ký tự.", 400)
  const config = cloudinary.config()
  if (!config.cloud_name || !config.api_key || !config.api_secret) return documentError("Chưa cấu hình Cloudinary để lưu tài liệu.", 503)
  try {
    const id = new ObjectId(); const publicId = `study-documents/${auth.userId}/${id}.pdf`; const now = new Date()
    await withTransaction(async session => {
      const db = await getDb()
      // Serialize reservations for one owner so simultaneous uploads obey the quota.
      await db.collection<{ _id: string; revision: number }>("document_limits").updateOne({ _id: auth.userId }, { $inc: { revision: 1 } }, { upsert: true, session })
      const docs = await documentCollection()
      if (await docs.countDocuments({ userId: auth.userId }, { session }) >= 20) throw new Error("DOCUMENT_LIMIT")
      await docs.insertOne({ _id: id, userId: auth.userId, title: body.title.trim(), subject: body.subject?.trim() ?? "", publicId, bytes: body.bytes, status: "pending", page: 1, bookmarks: [], notes: [], createdAt: now, updatedAt: now }, { session })
    })
    const params = { timestamp: Math.floor(Date.now() / 1000), public_id: publicId, type: "authenticated", overwrite: false }
    return NextResponse.json({ id: id.toString(), uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloud_name}/raw/upload`, params, apiKey: config.api_key, signature: cloudinary.utils.api_sign_request(params, config.api_secret) })
  } catch (error) { return documentError(error instanceof Error && error.message === "DOCUMENT_LIMIT" ? "Tối đa 20 tài liệu mỗi tài khoản. Xóa tài liệu không dùng hoặc bản tải dở để thêm mới." : undefined, error instanceof Error && error.message === "DOCUMENT_LIMIT" ? 409 : 500) }
}
