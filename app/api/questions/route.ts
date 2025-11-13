import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Question from '@/models/Question'

export async function GET(req: NextRequest) {
    await connectDB()

    const deckId = req.nextUrl.searchParams.get('deckId')
    if (!deckId) {
        return NextResponse.json({ error: 'Missing deckId' }, { status: 400 })
    }

    const questions = await Question.find({ deckId }).sort({ createdAt: 1 })
    return NextResponse.json(questions)
}
