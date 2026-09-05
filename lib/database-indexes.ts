import type { Db } from "mongodb"

// Increment the version whenever this index definition changes. Each version
// gets its own marker so overlapping deployments cannot overwrite one another.
export const INDEX_VERSION = "study-indexes-v1"

export async function ensureDatabaseIndexes(db: Db): Promise<void> {
  const versions = db.collection<{ _id: string; completedAt: Date }>("_schema_versions")
  if (await versions.findOne({ _id: INDEX_VERSION }, { projection: { _id: 1 } })) return

  const results = await Promise.allSettled([
    db.collection("decks").createIndex({ userId: 1, deletedAt: 1, createdAt: -1 }),
    db.collection("decks").createIndex({ shareToken: 1 }, { sparse: true, unique: true }),
    db.collection("flashcards").createIndex({ deckId: 1, dueAt: 1 }),
    db.collection("questions").createIndex({ deckId: 1, dueAt: 1 }),
    db.collection("review_logs").createIndex({ deckId: 1, createdAt: 1 }),
    db.collection("review_logs").createIndex({ itemId: 1, requestId: 1 }),
    db.collection("mcq_results").createIndex({ userId: 1, deckId: 1, updatedAt: -1 }),
    db.collection("mcq_results").createIndex({ userId: 1, deckId: 1, attemptId: 1 }, { unique: true, partialFilterExpression: { attemptId: { $type: "string" } } }),
    db.collection("media").createIndex({ ownerId: 1, createdAt: -1 }),
    db.collection("ai_usage").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ])
  const failed = results.find(result => result.status === "rejected")
  if (failed?.status === "rejected") throw failed.reason

  // Never mark an incomplete/failed index setup as ready.
  await versions.updateOne(
    { _id: INDEX_VERSION },
    { $set: { completedAt: new Date() } },
    { upsert: true },
  )
}
