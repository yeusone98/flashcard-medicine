// models/Question.ts
import mongoose, { Schema, Document, models, Types } from 'mongoose'

interface IChoice {
    text: string
    isCorrect: boolean
    image?: string
}

export interface IQuestion extends Document {
    deckId: Types.ObjectId | string
    flashcardId?: Types.ObjectId | string
    question: string
    choices: IChoice[]
    image?: string
    explanation?: string
    tags?: string[]
    order?: number
    level: number
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

const ChoiceSchema = new Schema<IChoice>(
    {
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
        image: String,
    },
    { _id: false }
)

const QuestionSchema = new Schema<IQuestion>(
    {
        deckId: { type: Schema.Types.ObjectId, ref: 'Deck', required: true },
        flashcardId: { type: Schema.Types.ObjectId, ref: 'Flashcard' },
        question: { type: String, required: true },
        choices: { type: [ChoiceSchema], required: true },
        image: String,
        explanation: String,
        tags: [String],
        order: Number,
        level: { type: Number, default: 0 },
        sm2Repetitions: Number,
        sm2Interval: Number,
        sm2Easiness: Number,
        dueAt: Date,
        lastReviewedAt: Date,
        fsrsState: Number,
        fsrsStability: Number,
        fsrsDifficulty: Number,
        fsrsElapsedDays: Number,
        fsrsScheduledDays: Number,
        fsrsLearningSteps: Number,
        fsrsReps: Number,
        fsrsLapses: Number,
        reviewRating: String,
        reviewIntervalMinutes: Number,
    },
    { timestamps: true }
)

export default models.Question ||
    mongoose.model<IQuestion>('Question', QuestionSchema)
