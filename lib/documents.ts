import { NextResponse } from "next/server"
import { getDb, ObjectId } from "@/lib/mongodb"
import cloudinary from "@/lib/cloudinary"

export const MAX_PDF_BYTES = 10 * 1024 * 1024
export interface StudyDocument {
  _id: ObjectId; userId: string; title: string; subject: string; publicId: string;
  status: "pending" | "ready"; bytes: number; page: number;
  bookmarks: number[]; notes: { id: string; page: number; text: string }[];
  createdAt: Date; updatedAt: Date;
}
export async function documentCollection() { return (await getDb()).collection<StudyDocument>("documents") }
export async function ownedDocument(id: string, userId: string) {
  if (!ObjectId.isValid(id)) return null
  return (await documentCollection()).findOne({ _id: new ObjectId(id), userId })
}
export function documentJson(doc: StudyDocument) {
  return { id: doc._id.toString(), title: doc.title, subject: doc.subject, status: doc.status, bytes: doc.bytes, page: doc.page, bookmarks: doc.bookmarks, notes: doc.notes, createdAt: doc.createdAt }
}
export function privatePdfUrl(doc: StudyDocument) {
  return cloudinary.utils.private_download_url(doc.publicId, "", { resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 300, attachment: false })
}
export function documentError(message = "Không xử lý được tài liệu. Vui lòng thử lại.", status = 500) {
  return NextResponse.json({ error: message }, { status })
}

// Bounded reads keep each response below the function payload limit even when
// the storage provider ignores Range. Never accept an arbitrary upstream URL.
export async function readPdfChunk(doc: StudyDocument, offset: number, size: number) {
  const response = await fetch(privatePdfUrl(doc), { headers: { Range: `bytes=${offset}-${offset + size - 1}` }, cache: "no-store", signal: AbortSignal.timeout(20000) })
  if (!response.ok || !response.body) throw new Error("PDF_DOWNLOAD_FAILED")
  const reader = response.body.getReader()
  let skip = response.status === 206 ? 0 : offset
  const chunks: Uint8Array[] = []; let count = 0
  try {
    while (count < size) {
      const { done, value } = await reader.read(); if (done) break
      if (skip >= value.length) { skip -= value.length; continue }
      const part = value.subarray(skip, skip + size - count); skip = 0
      chunks.push(part); count += part.length
    }
  } finally { await reader.cancel() }
  const result = new Uint8Array(count); let position = 0
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.length }
  return result
}
