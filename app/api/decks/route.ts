// app/api/decks/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getDecksCollection } from "@/lib/mongodb"
import { getDefaultDeckOptions } from "@/lib/fsrs"

export async function GET() {
    const decksCol = await getDecksCollection()
    const decks = await decksCol.find({}).sort({ createdAt: -1 }).toArray()

    // Chuyển ObjectId → string cho FE (giống Mongoose)
    const data = decks.map((d) => ({
        ...d,
        _id: d._id?.toString(),
    }))

    return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
    try {
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
            typeof body?.description === "string"
                ? body.description.trim()
                : ""
        const subject =
            typeof body?.subject === "string" ? body.subject.trim() : ""

        const decksCol = await getDecksCollection()
        const now = new Date()

        const deckInsert = await decksCol.insertOne({
            name,
            description: description || undefined,
            subject: subject || undefined,
            options: getDefaultDeckOptions(),
            createdAt: now,
            updatedAt: now,
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
