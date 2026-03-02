import { requireSession } from "@/lib/require-user"
import ImportTypeClient from "../_components/import-type-client"

export default async function ImportFlashcardPage() {
  await requireSession()
  return <ImportTypeClient kind="flashcard" />
}
