// app/api/shared/[token]/route.ts
import { NextRequest, NextResponse } from "next/server"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  getUsersCollection,
} from "@/lib/mongodb"
import { getActiveDeckFilter } from "@/lib/decks"

export const runtime = "nodejs"

// GET — xem deck qua shareToken (không cần auth)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: "Thiếu token" }, { status: 400 })
    }

    const [decksCol, flashcardsCol, questionsCol, usersCol] = await Promise.all([
      getDecksCollection(),
      getFlashcardsCollection(),
      getQuestionsCollection(),
      getUsersCollection(),
    ])

    const deck = await decksCol.findOne(
      getActiveDeckFilter({ shareToken: token, isPublic: true }),
    )
    if (!deck) {
      return NextResponse.json({ error: "Deck không tồn tại hoặc chưa được chia sẻ" }, { status: 404 })
    }

    const deckId = deck._id!

    const [flashcards, questions, owner] = await Promise.all([
      flashcardsCol
        .find({ deckId }, { projection: { front: 1, tags: 1, order: 1 } })
        .sort({ order: 1 })
        .limit(50)
        .toArray(),
      questionsCol
        .countDocuments({ deckId }),
      usersCol.findOne({ _id: deck.userId }, { projection: { name: 1, email: 1 } }),
    ])

    return NextResponse.json({
      id: deckId.toString(),
      name: deck.name,
      description: deck.description ?? "",
      subject: deck.subject ?? "",
      shareToken: token,
      ownerName: owner?.name ?? owner?.email ?? "Ẩn danh",
      flashcardCount: await flashcardsCol.countDocuments({ deckId }),
      questionCount: questions,
      previewCards: flashcards.map((c) => ({
        _id: c._id!.toString(),
        front: c.front,
        tags: c.tags ?? [],
      })),
      updatedAt: deck.updatedAt,
    })
  } catch (err) {
    console.error("Error fetching shared deck", err)
    return NextResponse.json({ error: "Không thể tải deck" }, { status: 500 })
  }
}
