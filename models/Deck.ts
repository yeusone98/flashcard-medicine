import mongoose, { Schema, Document, models } from 'mongoose'

export interface IDeck extends Document {
  name: string
  description?: string
  subject?: string
}

const DeckSchema = new Schema<IDeck>(
  {
    name: { type: String, required: true },
    description: String,
    subject: String,
  },
  { timestamps: true }
)

export default models.Deck || mongoose.model<IDeck>('Deck', DeckSchema)
