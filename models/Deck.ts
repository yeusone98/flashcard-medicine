import mongoose, { Schema, Document, models } from 'mongoose'

export interface IDeck extends Document {
  name: string
  description?: string
  subject?: string
  options?: {
    newPerDay: number
    reviewPerDay: number
    learningSteps: string[]
    relearningSteps: string[]
  }
}

const DeckSchema = new Schema<IDeck>(
  {
    name: { type: String, required: true },
    description: String,
    subject: String,
    options: {
      newPerDay: { type: Number, default: 20 },
      reviewPerDay: { type: Number, default: 200 },
      learningSteps: { type: [String], default: ["1m", "10m"] },
      relearningSteps: { type: [String], default: ["10m"] },
    },
  },
  { timestamps: true }
)

export default models.Deck || mongoose.model<IDeck>('Deck', DeckSchema)
