import { NextRequest, NextResponse } from "next/server"
import { getQuestionsCollection, ObjectId } from "@/lib/mongodb"

export async function GET(req: NextRequest) {
    const deckId = req.nextUrl.searchParams.get("deckId")
    if (!deckId || !ObjectId.isValid(deckId)) {
        return NextResponse.json({ error: "Missing or invalid deckId" }, { status: 400 })
    }

    const deckObjectId = new ObjectId(deckId)
    const questionsCol = await getQuestionsCollection()

    const questions = await questionsCol
        .find({ deckId: deckObjectId })
        .sort({ createdAt: 1 })
        .toArray()

    const data = questions.map((q) => ({
        ...q,
        _id: q._id.toString(),
        deckId: q.deckId.toString(),
        flashcardId: q.flashcardId?.toString(),
    }))

    return NextResponse.json(data)
}
