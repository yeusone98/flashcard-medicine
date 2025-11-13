// app/api/import/mcq/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Deck from '@/models/Deck'
import Question from '@/models/Question'
import mammoth from 'mammoth'
import { parseMCFromText } from '@/lib/parsers'

export const runtime = 'nodejs'

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

    const questions = parseMCFromText(text)

    if (!questions.length) {
        return NextResponse.json(
            { error: 'Không tìm thấy câu trắc nghiệm nào (Q: / A: / Correct:)' },
            { status: 400 }
        )
    }

    const deck = await Deck.create({
        name: deckName || file.name.replace('.docx', ''),
    })

    await Question.insertMany(
        questions.map(q => ({
            deckId: deck._id,
            question: q.question,
            choices: q.choices,
            explanation: q.explanation,
        }))
    )


    return NextResponse.json({
        deckId: deck._id,
        importedCount: questions.length,
    })
}
