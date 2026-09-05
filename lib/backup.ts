import { ObjectId, type Document } from "mongodb"

export const BACKUP_FORMAT = "flashcard-medicine"
const dates = new Set(["createdAt", "updatedAt", "dueAt", "lastReviewedAt", "nextDueAt", "reviewedAt"])
const numeric = new Set(["order", "level", "fsrsState", "fsrsStability", "fsrsDifficulty", "fsrsElapsedDays", "fsrsScheduledDays", "fsrsLearningSteps", "fsrsReps", "fsrsLapses", "reviewIntervalMinutes", "stability", "difficulty", "elapsedDays", "scheduledDays", "learningSteps", "reps", "lapses", "totalQuestions", "correctCount", "percent", "score10"])
const common = "order level createdAt updatedAt dueAt lastReviewedAt fsrsState fsrsStability fsrsDifficulty fsrsElapsedDays fsrsScheduledDays fsrsLearningSteps fsrsReps fsrsLapses reviewRating reviewIntervalMinutes tags"
const fields = {
  flashcards: `${common} front back frontImage backImage frontAudio backAudio fields note`,
  questions: `${common} question image explanation choices flashcardId`,
  reviewLogs: "itemType itemId rating state dueAt nextDueAt stability difficulty elapsedDays scheduledDays learningSteps reps lapses reviewedAt createdAt updatedAt",
  mcqResults: "totalQuestions correctCount percent score10 answers createdAt updatedAt",
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Bản sao lưu không hợp lệ")
  return value as Record<string, unknown>
}

export function restoreBackupData(value: unknown, userId: string) {
  const root = record(value)
  if (root.format !== BACKUP_FORMAT || root.version !== 1) throw new Error("Phiên bản backup không hỗ trợ")
  const deck = record(root.deck)
  if (typeof deck.name !== "string" || !deck.name.trim()) throw new Error("Backup thiếu tên deck")
  const deckId = new ObjectId()
  const ids = new Map<string, ObjectId>()
  const rows: Record<string, Record<string, unknown>[]> = {}
  for (const key of Object.keys(fields)) {
    if (!Array.isArray(root[key])) throw new Error(`Backup thiếu ${key}`)
    rows[key] = (root[key] as unknown[]).map(record)
    for (const row of rows[key]) {
      if (typeof row._id !== "string" || !ObjectId.isValid(row._id) || ids.has(row._id)) throw new Error("ID backup không hợp lệ hoặc trùng lặp")
      ids.set(row._id, new ObjectId())
    }
  }
  const remap = (id: unknown) => {
    if (typeof id !== "string" || !ObjectId.isValid(id)) throw new Error("Backup chứa ID tham chiếu không hợp lệ")
    // Deleted cards can still have review history. Remap their historical IDs too.
    if (!ids.has(id)) ids.set(id, new ObjectId())
    return ids.get(id)!
  }
  const result: Record<string, Document[]> = {}
  for (const [key, allowed] of Object.entries(fields)) {
    result[key] = rows[key].map(row => {
      const doc: Document = { _id: remap(row._id), deckId }
      for (const field of allowed.split(" ")) {
        const val = row[field]
        if (val === undefined) continue
        if (dates.has(field)) {
          if (val === null && (field === "dueAt" || field === "nextDueAt")) { doc[field] = null; continue }
          if (typeof val !== "string" || !Number.isFinite(Date.parse(val))) throw new Error(`Ngày ${field} không hợp lệ`)
          doc[field] = new Date(val)
        } else if (numeric.has(field)) {
          if (typeof val !== "number" || !Number.isFinite(val) || val < 0) throw new Error(`Số ${field} không hợp lệ`)
          doc[field] = val
        } else if (field === "itemId" || field === "flashcardId") doc[field] = remap(val)
        else if (field === "answers") {
          if (!Array.isArray(val)) throw new Error("Đáp án backup không hợp lệ")
          doc.answers = val.map(a => {
            const answer = record(a)
            return { questionId: answer.questionId ? remap(answer.questionId).toString() : undefined, selectedIndex: answer.selectedIndex, isCorrect: answer.isCorrect }
          })
        } else if (field === "choices") {
          if (!Array.isArray(val) || val.length < 2) throw new Error("Câu hỏi backup không hợp lệ")
          doc.choices = val.map(c => {
            const choice = record(c)
            if (typeof choice.text !== "string" || typeof choice.isCorrect !== "boolean") throw new Error("Lựa chọn không hợp lệ")
            return { text: choice.text, isCorrect: choice.isCorrect, ...(typeof choice.image === "string" ? { image: choice.image } : {}) }
          })
        } else if (field === "fields") {
          const map = record(val)
          if (Object.values(map).some(v => typeof v !== "string") || Object.keys(map).some(k => k.startsWith("$") || k.includes("."))) throw new Error("Fields không hợp lệ")
          doc.fields = map
        } else if (field === "tags") {
          if (!Array.isArray(val) || val.some(v => typeof v !== "string")) throw new Error("Tags không hợp lệ")
          doc.tags = val
        } else {
          if (typeof val !== "string") throw new Error(`${field} không hợp lệ`)
          doc[field] = val
        }
      }
      if (key === "flashcards" && (typeof doc.front !== "string" || typeof doc.back !== "string")) throw new Error("Thiếu nội dung thẻ")
      if (key === "questions" && (typeof doc.question !== "string" || !doc.choices)) throw new Error("Thiếu câu hỏi")
      if (key === "reviewLogs" && (!doc.itemId || !doc.reviewedAt)) throw new Error("Thiếu dữ liệu lịch sử ôn")
      if (key === "mcqResults") doc.userId = new ObjectId(userId)
      doc.createdAt ??= new Date()
      doc.updatedAt ??= doc.createdAt
      return doc
    })
  }
  return { deckId, deck, collections: result }
}
