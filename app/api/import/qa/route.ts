// app/api/import/qa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Deck from '@/models/Deck'
import Flashcard from '@/models/Flashcard'
import Question from '@/models/Question'      // ⬅️ thêm
import mammoth from 'mammoth'
import { parseQAPairs } from '@/lib/parsers'

export const runtime = 'nodejs'

// helper shuffle đơn giản
function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function POST(req: NextRequest) {
  await connectDB()

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const deckName = formData.get("deckName")?.toString() || ""
  const deckDescription = formData.get("deckDescription")?.toString() || ""


  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const result = await mammoth.extractRawText({ buffer })
  const text = result.value

  const cards = parseQAPairs(text) // [{ front: question, back: answer }]

  if (!cards.length) {
    return NextResponse.json(
      { error: 'Không tìm thấy cặp Q/A nào (Q: / A:)' },
      { status: 400 }
    )
  }

  // Tạo deck dùng chung
  const deck = await Deck.create({
    name: deckName || file.name.replace(".docx", ""),
    description: deckDescription || undefined,
  })


  // Lưu flashcard Q/A
  await Flashcard.insertMany(
    cards.map(c => ({
      deckId: deck._id,
      front: c.front,
      back: c.back,
    }))
  )

  // Tạo MCQ từ Q/A
  const questionsForMCQ = cards.map((c, idx) => {
    const wrongCandidates = cards
      .filter((_, j) => j !== idx)
      .map(card => card.back)

    const wrongShuffled = shuffle(wrongCandidates).slice(0, 3)
    const choiceTexts = [...wrongShuffled, c.back]

    const choices = shuffle(
      choiceTexts.map(text => ({
        text,
        isCorrect: text === c.back,
      }))
    )

    return {
      deckId: deck._id,
      question: c.front,  // câu hỏi = Q
      choices,
      explanation: c.back, // dùng A làm giải thích ngắn
    }
  })

  await Question.insertMany(questionsForMCQ)

  return NextResponse.json({
    deckId: deck._id,
    importedCount: cards.length,
  })
}
