// lib/mongodb.ts
import { MongoClient, ObjectId, Collection, Db } from "mongodb"

const uri = process.env.MONGODB_URI as string

if (!uri) {
  throw new Error("Please define the MONGODB_URI environment variable")
}

let client: MongoClient | null = null
let clientPromise: Promise<MongoClient> | null = null
let cachedDb: Db | null = null

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  client = new MongoClient(uri)
  clientPromise = client.connect()
}

export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb
  const c = await (clientPromise as Promise<MongoClient>)
  cachedDb = c.db("flashcard_medicine")
  return cachedDb
}

// Giữ lại connectDB cho những chỗ đang gọi `await connectDB()`
export async function connectDB() {
  return getDb()
}

// ===== Kiểu dữ liệu server-side (TS interface, không bắt buộc nhưng đẹp) =====
export interface DeckDoc {
  _id?: ObjectId
  name: string
  description?: string
  subject?: string
  options?: DeckOptionsDoc
  createdAt: Date
  updatedAt: Date
}

export interface DeckOptionsDoc {
  newPerDay: number
  reviewPerDay: number
  learningSteps: string[]
  relearningSteps: string[]
}

export interface FlashcardDoc {
  _id?: ObjectId
  deckId: ObjectId
  front: string
  back: string
  frontImage?: string
  backImage?: string
  frontAudio?: string
  backAudio?: string
  fields?: Record<string, string>
  tags?: string[]
  order?: number
  level: number
  createdAt: Date
  updatedAt: Date
  sm2Repetitions?: number
  sm2Interval?: number
  sm2Easiness?: number
  dueAt?: Date | null
  lastReviewedAt?: Date
  fsrsState?: number
  fsrsStability?: number
  fsrsDifficulty?: number
  fsrsElapsedDays?: number
  fsrsScheduledDays?: number
  fsrsLearningSteps?: number
  fsrsReps?: number
  fsrsLapses?: number

  // mới thêm
  reviewRating?: "hard" | "medium" | "easy"
  reviewIntervalMinutes?: number
  note?: string
}


export interface QuestionDoc {
  _id?: ObjectId
  deckId: ObjectId
  flashcardId?: ObjectId
  question: string
  choices: { text: string; isCorrect: boolean; image?: string }[]
  image?: string
  explanation?: string
  tags?: string[]
  order?: number
  level: number
  createdAt: Date
  updatedAt: Date
  sm2Repetitions?: number
  sm2Interval?: number
  sm2Easiness?: number
  dueAt?: Date | null
  lastReviewedAt?: Date
  fsrsState?: number
  fsrsStability?: number
  fsrsDifficulty?: number
  fsrsElapsedDays?: number
  fsrsScheduledDays?: number
  fsrsLearningSteps?: number
  fsrsReps?: number
  fsrsLapses?: number
  reviewRating?: "again" | "hard" | "good" | "easy"
  reviewIntervalMinutes?: number
}

export interface McqAnswerDoc {
  selectedIndex: number | null
  isCorrect: boolean | null
}

export interface McqResultDoc {
  _id?: ObjectId
  userId: ObjectId
  deckId: ObjectId
  totalQuestions: number
  correctCount: number
  percent: number
  score10: number
  answers: McqAnswerDoc[]    
  createdAt: Date
  updatedAt: Date
}

export interface ReviewLogDoc {
  _id?: ObjectId
  deckId: ObjectId
  itemType: "flashcard" | "question"
  itemId: ObjectId
  rating: "again" | "hard" | "good" | "easy"
  state: "new" | "learning" | "review" | "relearning"
  dueAt?: Date | null
  nextDueAt?: Date | null
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  reviewedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface UserDoc {
  _id?: ObjectId
  name?: string | null
  email: string
  password?: string
  image?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MediaDoc {
  _id?: ObjectId
  url: string
  publicId: string
  kind: "image" | "audio"
  resourceType: "image" | "video"
  format?: string
  bytes?: number
  width?: number
  height?: number
  duration?: number
  sha256: string
  ownerId?: ObjectId
  createdAt: Date
  updatedAt: Date
}

export async function getDecksCollection(): Promise<Collection<DeckDoc>> {
  const db = await getDb()
  return db.collection<DeckDoc>("decks")
}

export async function getFlashcardsCollection(): Promise<Collection<FlashcardDoc>> {
  const db = await getDb()
  return db.collection<FlashcardDoc>("flashcards")
}

export async function getQuestionsCollection(): Promise<Collection<QuestionDoc>> {
  const db = await getDb()
  return db.collection<QuestionDoc>("questions")
}

export async function getMcqResultsCollection(): Promise<Collection<McqResultDoc>> {
  const db = await getDb()
  return db.collection<McqResultDoc>("mcq_results")
}

export async function getReviewLogsCollection(): Promise<Collection<ReviewLogDoc>> {
  const db = await getDb()
  return db.collection<ReviewLogDoc>("review_logs")
}

export async function getUsersCollection(): Promise<Collection<UserDoc>> {
  const db = await getDb()
  return db.collection<UserDoc>("users")
}

export async function getMediaCollection(): Promise<Collection<MediaDoc>> {
  const db = await getDb()
  return db.collection<MediaDoc>("media")
}


// Để khỏi import từ "mongodb" nữa
export { ObjectId }
