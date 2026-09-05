import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { documentCollection, documentError, documentJson, MAX_PDF_BYTES, ownedDocument, readPdfChunk } from "@/lib/documents"
import cloudinary from "@/lib/cloudinary"
type Context = { params: Promise<{ id: string }> }
export async function GET(_req: NextRequest, ctx: Context) {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const doc = await ownedDocument((await ctx.params).id, auth.userId)
  return doc ? NextResponse.json(documentJson(doc), { headers: { "Cache-Control": "private, no-store" } }) : documentError("Không tìm thấy tài liệu.", 404)
}
export async function PATCH(req: NextRequest, ctx: Context) {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const doc = await ownedDocument((await ctx.params).id, auth.userId)
  if (!doc) return documentError("Không tìm thấy tài liệu.", 404)
  const body = await req.json().catch(() => null)
  if (!body) return documentError("Dữ liệu không hợp lệ.", 400)
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.complete === true && doc.status === "pending") {
      const asset = await cloudinary.api.resource(doc.publicId, { resource_type: "raw", type: "authenticated" })
      if (asset.bytes > MAX_PDF_BYTES || asset.bytes < 5) return documentError("File vượt giới hạn 10 MB. Hãy xóa bản tải này.", 400)
      const signature = await readPdfChunk(doc, 0, 5)
      if (new TextDecoder().decode(signature) !== "%PDF-") return documentError("File không phải PDF hợp lệ. Hãy xóa bản tải này.", 400)
      updates.status = "ready"; updates.bytes = asset.bytes
    }
    if (body.title !== undefined) { if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 160) return documentError("Tên tài liệu không hợp lệ.", 400); updates.title = body.title.trim() }
    if (body.subject !== undefined) { if (typeof body.subject !== "string" || body.subject.length > 100) return documentError("Tên môn học quá dài.", 400); updates.subject = body.subject.trim() }
    if (body.page !== undefined) { if (!Number.isInteger(body.page) || body.page < 1 || body.page > 100000) return documentError("Số trang không hợp lệ.", 400); updates.page = body.page }
    const collection = await documentCollection()
    if (body.bookmark !== undefined) {
      if (!Number.isInteger(body.bookmark) || body.bookmark < 1 || body.bookmark > 100000 || typeof body.remove !== "boolean") return documentError("Trang đánh dấu không hợp lệ.", 400)
      if (!body.remove && doc.bookmarks.length >= 500) return documentError("Tối đa 500 dấu trang.", 400)
      await collection.updateOne({ _id: doc._id, userId: auth.userId }, body.remove ? { $pull: { bookmarks: body.bookmark } } : { $addToSet: { bookmarks: body.bookmark } })
    }
    if (body.note !== undefined) {
      const note = body.note
      if (!note || typeof note.id !== "string" || !/^[a-zA-Z0-9-]{16,100}$/.test(note.id) || !Number.isInteger(note.page) || note.page < 1 || note.page > 100000 || typeof note.text !== "string" || !note.text.trim() || note.text.length > 5000) return documentError("Ghi chú không hợp lệ (tối đa 5.000 ký tự).", 400)
      if (doc.notes.length >= 200) return documentError("Tối đa 200 ghi chú mỗi tài liệu.", 400)
      await collection.updateOne({ _id: doc._id, userId: auth.userId, "notes.id": { $ne: note.id } }, { $push: { notes: { id: note.id, page: note.page, text: note.text.trim() } } })
    }
    if (typeof body.deleteNote === "string") await collection.updateOne({ _id: doc._id, userId: auth.userId }, { $pull: { notes: { id: body.deleteNote } } })
    await collection.updateOne({ _id: doc._id, userId: auth.userId }, { $set: updates })
    return NextResponse.json({ success: true })
  } catch { return documentError() }
}
export async function DELETE(_req: NextRequest, ctx: Context) {
  const auth = await requireAuth(); if (auth instanceof NextResponse) return auth
  const doc = await ownedDocument((await ctx.params).id, auth.userId)
  if (!doc) return documentError("Không tìm thấy tài liệu.", 404)
  try {
    const result = await cloudinary.uploader.destroy(doc.publicId, { resource_type: "raw", type: "authenticated", invalidate: true })
    if (!["ok", "not found"].includes(result.result)) return documentError("Chưa xóa được file. Vui lòng thử lại.")
    await (await documentCollection()).deleteOne({ _id: doc._id, userId: auth.userId })
    return NextResponse.json({ success: true })
  } catch { return documentError() }
}
