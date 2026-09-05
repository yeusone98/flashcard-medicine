import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest"
import { MongoMemoryReplSet } from "mongodb-memory-server"
import { NextRequest } from "next/server"
import { Collection } from "mongodb"
import { ensureDatabaseIndexes, INDEX_VERSION } from "@/lib/database-indexes"
import { getDb, ObjectId } from "@/lib/mongodb"

const identity = vi.hoisted(() => ({ id: "000000000000000000000001" }))
vi.mock("@/lib/auth-helpers", () => ({
  requireAuth: async () => ({ userId: identity.id, session: { user: { id: identity.id } } }),
  getUserIdFromSession: () => identity.id,
}))
vi.mock("@/lib/require-user", () => ({ requireSession: async () => ({ userId: identity.id }) }))
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: identity.id } }) }))
vi.mock("@/lib/cloudinary", () => ({ default: {
  config: () => ({ cloud_name: "test", api_key: "test-key", api_secret: "test-secret" }),
  utils: { api_sign_request: () => "test-signature", private_download_url: () => "https://pdf-storage.example.test/file" },
  api: { resource: vi.fn().mockResolvedValue({ bytes: 8 }) },
  uploader: { destroy: vi.fn().mockResolvedValue({ result: "ok" }) },
} }))
vi.mock("@/app/decks/[deckId]/flashcards/FlashcardStudyClient", () => ({ default: () => null }))

import { POST as review } from "@/app/api/flashcards/[id]/review/route"
import { POST as submit } from "@/app/api/mcq-results/route"
import { GET as exportDeck } from "@/app/api/decks/[id]/export/route"
import { POST as restore } from "@/app/api/import/backup/route"
import { DELETE as deleteMedia } from "@/app/api/media/[id]/route"
import { GET as listMedia } from "@/app/api/media/route"
import FlashcardPage from "@/app/decks/[deckId]/flashcards/page"
import { GET as listDocuments, POST as reserveDocument } from "@/app/api/documents/route"
import { GET as readDocument, PATCH as patchDocument, DELETE as deleteDocument } from "@/app/api/documents/[id]/route"
import { GET as readPdfFile } from "@/app/api/documents/[id]/file/route"
import { POST as documentCard } from "@/app/api/documents/[id]/flashcards/route"
import { reserveAiQuota } from "@/lib/ai-quota"

let mongo: MongoMemoryReplSet
const owner = new ObjectId("000000000000000000000001")
const outsider = new ObjectId("000000000000000000000002")
const deckId = new ObjectId()
const cardId = new ObjectId()
const q1 = new ObjectId()
const q2 = new ObjectId()
const params = (id: ObjectId) => ({ params: Promise.resolve({ id: id.toString() }) })
const request = (path: string, body?: unknown) => new NextRequest(`http://localhost${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined)

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: "7.0.14", downloadDir: "/tmp/flashcard-mongo-binaries" } })
  process.env.MONGODB_URI = mongo.getUri()
  await getDb()
})
afterAll(async () => {
  if (global._mongoClientPromise) await (await global._mongoClientPromise).close()
  await mongo?.stop()
})
beforeEach(async () => {
  identity.id = owner.toString()
  const db = await getDb()
  for (const name of ["decks", "flashcards", "questions", "review_logs", "mcq_results", "media", "ai_usage", "documents", "document_limits"]) await db.collection(name).deleteMany({})
  const dates = { createdAt: new Date(), updatedAt: new Date() }
  await db.collection("decks").insertOne({ _id: deckId, userId: owner, name: "Anatomy", ...dates })
  await db.collection("flashcards").insertOne({ _id: cardId, deckId, front: "Q", back: "A", fsrsState: 0, level: 0, ...dates })
  await db.collection("questions").insertMany([q1, q2].map(_id => ({ _id, deckId, question: "Question", choices: [{ text: "A", isCorrect: true }, { text: "B", isCorrect: false }], fsrsState: 0, ...dates })))
})

describe("database index bootstrap", () => {
  it("reuses the persisted index version across independent initializations", async () => {
    const client = await global._mongoClientPromise!
    const db = client.db("index_bootstrap_test")
    const createIndex = vi.spyOn(Collection.prototype, "createIndex")
    try {
      await ensureDatabaseIndexes(db)
      expect(createIndex).toHaveBeenCalledTimes(11)
      createIndex.mockClear()
      await ensureDatabaseIndexes(db)
      expect(createIndex).not.toHaveBeenCalled()
      const indexes = await db.collection("mcq_results").indexes()
      expect(indexes.some(index => index.unique && index.key.attemptId === 1)).toBe(true)
    } finally {
      createIndex.mockRestore()
      await db.dropDatabase()
    }
  })
  it("does not mark a failed setup complete and can retry", async () => {
    const client = await global._mongoClientPromise!
    const db = client.db("index_bootstrap_failure_test")
    const createIndex = vi.spyOn(Collection.prototype, "createIndex").mockRejectedValueOnce(new Error("index setup failed"))
    try {
      await expect(ensureDatabaseIndexes(db)).rejects.toThrow("index setup failed")
      expect(await db.collection<{ _id: string }>("_schema_versions").findOne({ _id: INDEX_VERSION })).toBeNull()
      await ensureDatabaseIndexes(db)
      expect(await db.collection<{ _id: string }>("_schema_versions").findOne({ _id: INDEX_VERSION })).not.toBeNull()
    } finally {
      createIndex.mockRestore()
      await db.dropDatabase()
    }
  })
})

describe("permissions", () => {
  it("rejects another account reading a private study page or reviewing it", async () => {
    identity.id = outsider.toString()
    await expect(FlashcardPage({ params: Promise.resolve({ deckId: deckId.toString() }) })).rejects.toThrow()
    expect((await review(request("/review", { rating: "good", requestId: crypto.randomUUID() }), params(cardId))).status).toBe(404)
  })
  it("hides and protects another account's media", async () => {
    const db = await getDb()
    const id = new ObjectId()
    await db.collection("media").insertOne({ _id: id, ownerId: outsider, url: "https://example.com/private.png" })
    const listed = await (await listMedia(request("/api/media"))).json()
    expect(listed.items).toHaveLength(0)
    expect((await deleteMedia(request("/media"), params(id))).status).toBe(404)
  })
  it("refuses deleting media referenced by a cloned card", async () => {
    const db = await getDb()
    const id = new ObjectId()
    const url = "https://example.com/shared.png"
    await db.collection("media").insertOne({ _id: id, ownerId: owner, url })
    await db.collection("flashcards").insertOne({ deckId: new ObjectId(), frontImage: url })
    expect((await deleteMedia(request("/media"), params(id))).status).toBe(409)
  })
})

describe("atomic study saves", () => {
  it.each(["again", "easy"])("retries a %s flashcard review without counting it twice", async (rating) => {
    const body = { rating, requestId: crypto.randomUUID() }
    const first = await review(request("/review", body), params(cardId))
    expect(first.status).toBe(200)
    const timing = first.headers.get("Server-Timing")!
    for (const phase of ["auth", "db_init", "read_card", "read_deck", "save_review", "transaction", "total"]) {
      expect(timing).toMatch(new RegExp(`${phase};dur=\\d+(?:\\.\\d+)?`))
    }
    expect(first.headers.get("Cache-Control")).toBe("private, no-store")
    const second = await review(request("/review", body), params(cardId))
    expect(await second.json()).toEqual(await first.json())
    const db = await getDb()
    expect(await db.collection("review_logs").countDocuments({})).toBe(1)
    expect((await db.collection("flashcards").findOne({ _id: cardId }))?.fsrsReps).toBe(1)
  })
  it("saves quiz answers by question ID, scores on the server, and retries once", async () => {
    const body = { deckId: deckId.toString(), attemptId: crypto.randomUUID(), correctCount: 999, answers: [{ questionId: q2.toString(), selectedIndex: 1 }, { questionId: q1.toString(), selectedIndex: 0 }] }
    expect((await submit(request("/quiz", body))).status).toBe(200)
    const retried = await submit(request("/quiz", body))
    const { result } = await retried.json()
    expect(result.correctCount).toBe(1)
    expect(result.answers[0].questionId).toBe(q2.toString())
    const db = await getDb()
    expect(await db.collection("mcq_results").countDocuments({})).toBe(1)
    expect(await db.collection("review_logs").countDocuments({})).toBe(2)
  })
  it("rolls back the first schedule when a later quiz answer is invalid", async () => {
    const res = await submit(request("/quiz", { deckId: deckId.toString(), attemptId: crypto.randomUUID(), answers: [{ questionId: q1.toString(), selectedIndex: 0 }, { questionId: q2.toString(), selectedIndex: 99 }] }))
    expect(res.status).toBe(400)
    const db = await getDb()
    expect(await db.collection("review_logs").countDocuments({})).toBe(0)
    expect((await db.collection("questions").findOne({ _id: q1 }))?.fsrsState).toBe(0)
  })
  it("handles concurrent submissions of the same answered quiz", async () => {
    const body = { deckId: deckId.toString(), attemptId: crypto.randomUUID(), answers: [{ questionId: q1.toString(), selectedIndex: 0 }] }
    const results = await Promise.all([submit(request("/quiz", body)), submit(request("/quiz", body))])
    expect(results.map(r => r.status)).toEqual([200, 200])
    expect(await (await getDb()).collection("review_logs").countDocuments({})).toBe(1)
  })
})

it("round-trips FSRS, media links, notes, tags and review history into new IDs", async () => {
  const db = await getDb()
  await review(request("/review", { rating: "good", requestId: crypto.randomUUID() }), params(cardId))
  await db.collection("flashcards").updateOne({ _id: cardId }, { $set: { note: "my note", tags: ["anatomy"], frontAudio: "https://example.com/a.mp3", fields: { hint: "hint" } } })
  const backup = await (await exportDeck(request("/export"), params(deckId))).json()
  const response = await restore(request("/restore", backup))
  expect(response.status).toBe(200)
  const restoredId = new ObjectId((await response.json()).deckId)
  const restored = await db.collection("flashcards").findOne({ deckId: restoredId })
  const original = await db.collection("flashcards").findOne({ _id: cardId })
  for (const field of ["fsrsStability", "fsrsDifficulty", "fsrsReps", "note", "tags", "frontAudio", "fields", "dueAt", "lastReviewedAt"]) expect(restored?.[field]).toEqual(original?.[field])
  expect(restored?._id.equals(cardId)).toBe(false)
  expect((await db.collection("review_logs").findOne({ deckId: restoredId }))?.itemId).toEqual(restored?._id)
})

it("limits each account to five AI attempts per Vietnam day", async () => {
  for (let i = 0; i < 5; i++) expect(await reserveAiQuota(owner.toString())).toBe(true)
  expect(await reserveAiQuota(owner.toString())).toBe(false)
  expect(await reserveAiQuota(outsider.toString())).toBe(true)
})


describe("private PDF documents", () => {
  const documentId = new ObjectId()
  async function seed(status = "ready") {
    const db = await getDb()
    await db.collection("documents").insertOne({ _id: documentId, userId: owner.toString(), title: "Anatomy PDF", subject: "Medicine", publicId: "private/test.pdf", status, bytes: 8, page: 1, bookmarks: [], notes: [], createdAt: new Date(), updatedAt: new Date() })
  }
  it("hides metadata, bytes, edits, deletion and card creation from another account", async () => {
    await seed(); identity.id = outsider.toString()
    expect(await (await listDocuments()).json()).toEqual([])
    expect((await readDocument(request("/doc"), params(documentId))).status).toBe(404)
    expect((await readPdfFile(request("/file"), params(documentId))).status).toBe(404)
    expect((await patchDocument(request("/doc", { page: 2 }), params(documentId))).status).toBe(404)
    expect((await deleteDocument(request("/doc"), params(documentId))).status).toBe(404)
    expect((await documentCard(request("/card", {}), params(documentId))).status).toBe(404)
  })
  it("reserves an authenticated upload with an owner-scoped server-generated ID", async () => {
    const result = await reserveDocument(request("/docs", { title: "PDF", bytes: 8, publicId: "victim" }))
    expect(result.status).toBe(200)
    const body = await result.json()
    expect(body.params.type).toBe("authenticated")
    expect(body.params.overwrite).toBe(false)
    expect(body.params.public_id).toContain(`study-documents/${owner}/`)
    expect(JSON.stringify(body)).not.toContain("test-secret")
    expect((await reserveDocument(request("/docs", { title: "PDF", bytes: 11 * 1024 * 1024 }))).status).toBe(400)
  })
  it("validates the uploaded PDF before making it readable", async () => {
    await seed("pending")
    const mock = vi.fn().mockImplementation(async () => new Response("%PDF-1.7"))
    vi.stubGlobal("fetch", mock)
    try {
      expect((await readPdfFile(request("/file"), params(documentId))).status).toBe(404)
      expect((await patchDocument(request("/doc", { complete: true }), params(documentId))).status).toBe(200)
      const result = await readPdfFile(request("/file?offset=2"), params(documentId))
      expect(await result.text()).toBe("DF-1.7")
      expect(result.headers.get("Cache-Control")).toBe("private, no-store")
    } finally { vi.unstubAllGlobals() }
  })
  it("rejects a non-PDF without publishing the pending upload", async () => {
    await seed("pending"); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not a PDF")))
    try {
      expect((await patchDocument(request("/doc", { complete: true }), params(documentId))).status).toBe(400)
      expect((await (await readDocument(request("/doc"), params(documentId))).json()).status).toBe("pending")
    } finally { vi.unstubAllGlobals() }
  })
  it("persists progress and idempotent bookmarks and notes", async () => {
    await seed()
    const note = { id: crypto.randomUUID(), page: 3, text: "Remember this" }
    for (let i = 0; i < 2; i++) expect((await patchDocument(request("/doc", { page: 3, bookmark: 3, remove: false, note }), params(documentId))).status).toBe(200)
    const data = await (await readDocument(request("/doc"), params(documentId))).json()
    expect(data.page).toBe(3); expect(data.bookmarks).toEqual([3]); expect(data.notes).toHaveLength(1)
    expect((await patchDocument(request("/doc", { page: -1 }), params(documentId))).status).toBe(400)
    expect((await patchDocument(request("/doc", { note: null }), params(documentId))).status).toBe(400)
  })
  it("creates one sourced flashcard on retry and requires deck ownership", async () => {
    await seed()
    const body = { deckId: deckId.toString(), page: 4, front: "Question", back: "Answer", requestId: crypto.randomUUID() }
    const first = await documentCard(request("/card", body), params(documentId))
    const second = await documentCard(request("/card", body), params(documentId))
    expect(first.status).toBe(200); expect(await second.json()).toEqual(await first.json())
    const db = await getDb(); const cards = await db.collection("flashcards").find({ sourceDocumentId: documentId }).toArray()
    expect(cards).toHaveLength(1); expect(cards[0].fields.source).toBe("Anatomy PDF · Trang 4")
    await db.collection("decks").updateOne({ _id: deckId }, { $set: { userId: outsider } })
    expect((await documentCard(request("/card", { ...body, requestId: crypto.randomUUID() }), params(documentId))).status).toBe(404)
  })
})
