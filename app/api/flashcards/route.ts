// app/api/flashcards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Flashcard from '@/models/Flashcard'

export async function GET(req: NextRequest) {
  await connectDB()

  const deckId = req.nextUrl.searchParams.get('deckId')
  if (!deckId) {
    return NextResponse.json({ error: 'Missing deckId' }, { status: 400 })
  }

  const cards = await Flashcard.find({ deckId }).sort({ createdAt: 1 })
  return NextResponse.json(cards)
}
