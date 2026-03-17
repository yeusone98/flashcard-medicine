import { NextRequest, NextResponse } from "next/server"
import { getFlashcardsCollection, getDecksCollection, ObjectId } from "@/lib/mongodb"
import { requireAuth } from "@/lib/auth-helpers"
import { normalizeImage, normalizeTags, normalizeFields } from "@/lib/normalize"
import { State } from "ts-fsrs"



export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const deckId = req.nextUrl.searchParams.get("deckId")
  if (!deckId || !ObjectId.isValid(deckId)) {
    return NextResponse.json({ error: "Missing or invalid deckId" }, { status: 400 })
  }

  // Verify deck ownership
  const decksCol = await getDecksCollection()
  const deck = await decksCol.findOne({ _id: new ObjectId(deckId), userId: new ObjectId(userId) })
  if (!deck) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 })
  }

  const deckObjectId = new ObjectId(deckId)
  const flashcardsCol = await getFlashcardsCollection()

  const cards = await flashcardsCol
    .find({ deckId: deckObjectId })
    .sort({ order: 1, createdAt: 1 })
    .toArray()

  const data = cards.map((c) => ({
    ...c,
    _id: c._id.toString(),
    deckId: c.deckId.toString(),
  }))

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json()

    const deckId = typeof body?.deckId === "string" ? body.deckId : ""
    if (!deckId || !ObjectId.isValid(deckId)) {
      return NextResponse.json(
        { error: "Missing or invalid deckId" },
        { status: 400 },
      )
    }

    // Verify deck ownership
    const decksCol = await getDecksCollection()
    const deck = await decksCol.findOne({ _id: new ObjectId(deckId), userId: new ObjectId(userId) })
    if (!deck) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    const deckObjectId = new ObjectId(deckId)
    const flashcardsCol = await getFlashcardsCollection()
    const now = new Date()

    const items = Array.isArray(body?.flashcards)
      ? body.flashcards
      : [
        {
          front: body?.front,
          back: body?.back,
          frontImage: body?.frontImage,
          backImage: body?.backImage,
        },
      ]

    const docs = items
      .map((fc: any) => ({
        deckId: deckObjectId,
        front: typeof fc?.front === "string" ? fc.front.trim() : "",
        back: typeof fc?.back === "string" ? fc.back.trim() : "",
        frontImage: normalizeImage(fc?.frontImage),
        backImage: normalizeImage(fc?.backImage),
        frontAudio: normalizeImage(fc?.frontAudio),
        backAudio: normalizeImage(fc?.backAudio),
        fields: normalizeFields(fc?.fields),
        tags: normalizeTags(fc?.tags),
        order: typeof fc?.order === "number" ? fc.order : undefined,
        level: 0,
        fsrsState: State.New,
        createdAt: now,
        updatedAt: now,
      }))
      .filter((fc: { front: string; back: string }) => fc.front && fc.back)

    if (docs.length === 0) {
      return NextResponse.json(
        { error: "No valid flashcards to insert" },
        { status: 400 },
      )
    }

    const result = await flashcardsCol.insertMany(docs)
    const insertedIds = Object.values(result.insertedIds).map((id) =>
      id.toString(),
    )

    return NextResponse.json({
      success: true,
      insertedCount: result.insertedCount,
      ids: insertedIds,
    })
  } catch (error) {
    console.error("Error creating flashcards", error)
    return NextResponse.json(
      { error: "Failed to create flashcards" },
      { status: 500 },
    )
  }
}
