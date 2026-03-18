// app/api/decks/route.ts
import { NextRequest, NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth-helpers"
import {
  createDeck,
  getOwnedActiveDeckFilter,
  getOwnedDeletedDeckFilter,
} from "@/lib/decks"
import { getDecksCollection } from "@/lib/mongodb"

export async function GET(req: NextRequest) {
  const authResult = await requireAuth()
  if (authResult instanceof NextResponse) return authResult
  const { userId } = authResult

  const status = req.nextUrl.searchParams.get("status") ?? "active"
  const decksCol = await getDecksCollection()
  const query =
    status === "deleted"
      ? getOwnedDeletedDeckFilter(userId)
      : getOwnedActiveDeckFilter(userId)
  const sort =
    status === "deleted"
      ? ({ deletedAt: -1, updatedAt: -1 } as const)
      : ({ createdAt: -1 } as const)

  const decks = await decksCol.find(query).sort(sort).toArray()

  return NextResponse.json(
    decks.map((deck) => ({
      ...deck,
      _id: deck._id?.toString(),
    })),
  )
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) return authResult
    const { userId } = authResult

    const body = await req.json().catch(() => ({}))
    const rawName = typeof body?.name === "string" ? body.name : ""
    const name = rawName.trim()

    if (!name) {
      return NextResponse.json(
        { error: "Missing deck name" },
        { status: 400 },
      )
    }

    const description =
      typeof body?.description === "string" ? body.description.trim() : ""
    const subject =
      typeof body?.subject === "string" ? body.subject.trim() : ""

    const deckInsert = await createDeck({
      userId,
      name,
      description,
      subject,
    })

    return NextResponse.json({
      success: true,
      deckId: deckInsert.insertedId.toString(),
      deckName: name,
    })
  } catch (error) {
    console.error("Error creating deck", error)
    return NextResponse.json(
      { error: "Failed to create deck" },
      { status: 500 },
    )
  }
}
