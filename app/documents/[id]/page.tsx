import { notFound } from "next/navigation"
import { requireSession } from "@/lib/require-user"
import { ownedDocument, documentJson } from "@/lib/documents"
import ReaderLoader from "./reader-loader"
export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireSession()
  const doc = await ownedDocument((await params).id, userId)
  if (!doc || doc.status !== "ready") notFound()
  return <ReaderLoader document={JSON.parse(JSON.stringify(documentJson(doc)))} />
}
