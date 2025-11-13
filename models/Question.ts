// models/Question.ts
import mongoose, { Schema, Document, models, Types } from 'mongoose'

interface IChoice {
    text: string
    isCorrect: boolean
}

export interface IQuestion extends Document {
    deckId: Types.ObjectId | string
    flashcardId?: Types.ObjectId | string
    question: string
    choices: IChoice[]
    explanation?: string
    level: number
}

const ChoiceSchema = new Schema<IChoice>(
    {
        text: { type: String, required: true },
        isCorrect: { type: Boolean, default: false },
    },
    { _id: false }
)

const QuestionSchema = new Schema<IQuestion>(
    {
        deckId: { type: Schema.Types.ObjectId, ref: 'Deck', required: true },
        flashcardId: { type: Schema.Types.ObjectId, ref: 'Flashcard' },
        question: { type: String, required: true },
        choices: { type: [ChoiceSchema], required: true },
        explanation: String,
        level: { type: Number, default: 0 },
    },
    { timestamps: true }
)

export default models.Question ||
    mongoose.model<IQuestion>('Question', QuestionSchema)
