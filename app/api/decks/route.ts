// app/api/decks/route.ts
import { NextResponse } from "next/server"
import { getDecksCollection } from "@/lib/mongodb"

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
