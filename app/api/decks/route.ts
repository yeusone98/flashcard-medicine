import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Deck from '@/models/Deck'

export async function GET() {
    await connectDB()
    const decks = await Deck.find().sort({ createdAt: -1 })
    return NextResponse.json(decks)
}
