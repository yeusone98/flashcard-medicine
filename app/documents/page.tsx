import { requireSession } from "@/lib/require-user"
import DocumentLibrary from "./library-client"
export default async function DocumentsPage() { await requireSession(); return <DocumentLibrary /> }
