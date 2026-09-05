import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-helpers"
import { restoreBackupData } from "@/lib/backup"
import { getDb, ObjectId, withTransaction } from "@/lib/mongodb"
import { normalizeDeckOptions, type DeckOptions } from "@/lib/fsrs"

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  let backup: ReturnType<typeof restoreBackupData>
  try { backup = restoreBackupData(await req.json(), auth.userId) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Backup không hợp lệ" }, { status: 400 }) }
  try {
    await withTransaction(async session => {
      const db = await getDb()
      const { deck, deckId, collections } = backup
      await db.collection("decks").insertOne({ _id: deckId, userId: new ObjectId(auth.userId), name: deck.name, description: typeof deck.description === "string" ? deck.description : "", subject: typeof deck.subject === "string" ? deck.subject : "", options: normalizeDeckOptions(deck.options as Partial<DeckOptions>), createdAt: new Date(), updatedAt: new Date() }, { session })
      for (const [key, docs] of Object.entries(collections)) {
        const name = key === "reviewLogs" ? "review_logs" : key === "mcqResults" ? "mcq_results" : key
        if (docs.length) await db.collection(name).insertMany(docs, { session })
      }
    })
    return NextResponse.json({ success: true, deckId: backup.deckId.toString() })
  } catch (error) {
    console.error("Backup restore failed", error)
    return NextResponse.json({ error: "Chưa thể khôi phục backup. Dữ liệu chưa được ghi." }, { status: 500 })
  }
}
