// app/api/import/cloze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Deck from '@/models/Deck'
import Flashcard from '@/models/Flashcard'
import mammoth from 'mammoth'
import { parseClozeFlashcards } from '@/lib/parsers'

export const runtime = 'nodejs' // để dùng Buffer/mammoth

export async function POST(req: NextRequest) {
  await connectDB()

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const deckName = formData.get('deckName')?.toString() || ''

  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const result = await mammoth.extractRawText({ buffer })
  const text = result.value

  const cards = parseClozeFlashcards(text)

  if (!cards.length) {
    return NextResponse.json(
      { error: 'Không tìm thấy flashcard Cloze nào ({{}})' },
      { status: 400 }
    )
  }

  const deck = await Deck.create({
    name: deckName || file.name.replace('.docx', ''),
  })

  await Flashcard.insertMany(
    cards.map(c => ({
      deckId: deck._id,
      front: c.front,
      back: c.back,
    }))
  )

  return NextResponse.json({
    deckId: deck._id,
    importedCount: cards.length,
  })
}
