// models/Flashcard.ts
import mongoose, { Schema, Document, models, Types } from 'mongoose'

export interface IFlashcard extends Document {
  deckId: Types.ObjectId   // đổi từ string -> Types.ObjectId
  front: string
  back: string
  level: number
}

const FlashcardSchema = new Schema<IFlashcard>(
  {
    deckId: { type: Schema.Types.ObjectId, ref: 'Deck', required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    level: { type: Number, default: 0 },
  },
  { timestamps: true }
)

export default models.Flashcard ||
  mongoose.model<IFlashcard>('Flashcard', FlashcardSchema)
