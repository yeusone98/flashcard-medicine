import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, ObjectId } from "@/lib/mongodb"

export async function GET(req: NextRequest) {
  const deckId = req.nextUrl.searchParams.get("deckId")
  if (!deckId || !ObjectId.isValid(deckId)) {
    return NextResponse.json({ error: "Missing or invalid deckId" }, { status: 400 })
  }

  const deckObjectId = new ObjectId(deckId)
  const flashcardsCol = await getFlashcardsCollection()

  const cards = await flashcardsCol
    .find({ deckId: deckObjectId })
    .sort({ createdAt: 1 })
    .toArray()

  const data = cards.map((c) => ({
    ...c,
    _id: c._id.toString(),
    deckId: c.deckId.toString(),
  }))

  return NextResponse.json(data)
}
