import { getDb, withTransaction } from "@/lib/mongodb"
import { studyDateKey } from "@/lib/study-time"

// Both counters are reserved atomically; retries/failures still consume a slot.
export async function reserveAiQuota(userId: string): Promise<boolean> {
  const db = await getDb()
  const counters = db.collection<{ _id: string; count: number; expiresAt: Date }>("ai_usage")
  return withTransaction(async session => {
    for (const [key, limit] of [[`user:${userId}`, 5], ["global", 20]] as const) {
      const _id = `${studyDateKey()}:${key}`
      const current = await counters.findOne({ _id }, { session })
      if ((current?.count ?? 0) >= limit) throw new Error("AI_QUOTA_EXCEEDED")
      await counters.updateOne({ _id }, { $inc: { count: 1 }, $set: { expiresAt: new Date(Date.now() + 3 * 86400000) } }, { upsert: true, session })
    }
    return true
  }).catch(error => {
    if (error instanceof Error && error.message === "AI_QUOTA_EXCEEDED") return false
    throw error
  })
}
