// models/Flashcard.ts
import mongoose, { Schema, Document, models, Types } from 'mongoose'

export interface IFlashcard extends Document {
  deckId: Types.ObjectId   // switch from string -> Types.ObjectId
  front: string
  back: string
  frontImage?: string
  backImage?: string
  tags?: string[]
  order?: number
  level: number
  sm2Repetitions?: number
  sm2Interval?: number
  sm2Easiness?: number
  dueAt?: Date | null
  lastReviewedAt?: Date
  reviewRating?: "again" | "hard" | "good" | "easy"
  reviewIntervalMinutes?: number
}

const FlashcardSchema = new Schema<IFlashcard>(
  {
    deckId: { type: Schema.Types.ObjectId, ref: 'Deck', required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    frontImage: String,
    backImage: String,
    tags: [String],
    order: Number,
    level: { type: Number, default: 0 },
    sm2Repetitions: Number,
    sm2Interval: Number,
    sm2Easiness: Number,
    dueAt: Date,
    lastReviewedAt: Date,
    reviewRating: String,
    reviewIntervalMinutes: Number,
  },
  { timestamps: true }
)

export default models.Flashcard ||
  mongoose.model<IFlashcard>('Flashcard', FlashcardSchema)
