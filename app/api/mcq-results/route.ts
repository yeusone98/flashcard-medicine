// app/api/mcq-results/route.ts
import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"
import { getMcqResultsCollection, ObjectId } from "@/lib/mongodb"

export const runtime = "nodejs"

function getUserIdFromSession(session: Session | null): string | undefined {
  if (!session?.user) return undefined
  if ("id" in session.user && typeof session.user.id === "string") {
    return session.user.id
  }
  return undefined
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    const deckId = req.nextUrl.searchParams.get("deckId")
    if (!deckId) {
      return NextResponse.json(
        { error: "Thiếu deckId" },
        { status: 400 },
      )
    }

    let deckObjectId: ObjectId
    try {
      deckObjectId = new ObjectId(deckId)
    } catch {
      return NextResponse.json(
        { error: "deckId không hợp lệ" },
        { status: 400 },
      )
    }

    const collection = await getMcqResultsCollection()
    const existing = await collection.findOne({
      userId: new ObjectId(userId),
      deckId: deckObjectId,
    })

    if (!existing) {
      return NextResponse.json({ result: null })
    }

    return NextResponse.json({
      result: {
        totalQuestions: existing.totalQuestions,
        correctCount: existing.correctCount,
        percent: existing.percent,
        score10: existing.score10,
        createdAt: existing.createdAt.toISOString(),
        answers: existing.answers ?? [],
      },
    })
  } catch (error) {
    console.error("[MCQ_RESULTS][GET] error", error)
    return NextResponse.json(
      { error: "Không thể lấy kết quả" },
      { status: 500 },
    )
  }
}

type AnswerPayload = {
  selectedIndex: number | null
  isCorrect: boolean | null
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    const body = (await req.json()) as {
      deckId?: string
      totalQuestions?: number
      correctCount?: number
      percent?: number
      score10?: number
      answers?: AnswerPayload[]
    }

    const {
      deckId,
      totalQuestions,
      correctCount,
      percent,
      score10,
      answers,
    } = body

    if (!deckId) {
      return NextResponse.json(
        { error: "Thiếu deckId" },
        { status: 400 },
      )
    }

    if (
      typeof totalQuestions !== "number" ||
      typeof correctCount !== "number" ||
      typeof percent !== "number" ||
      typeof score10 !== "number"
    ) {
      return NextResponse.json(
        { error: "Dữ liệu kết quả không hợp lệ" },
        { status: 400 },
      )
    }

    let deckObjectId: ObjectId
    try {
      deckObjectId = new ObjectId(deckId)
    } catch {
      return NextResponse.json(
        { error: "deckId không hợp lệ" },
        { status: 400 },
      )
    }

    let normalizedAnswers: AnswerPayload[] = []
    if (Array.isArray(answers)) {
      normalizedAnswers = answers.map(a => ({
        selectedIndex:
          typeof a?.selectedIndex === "number" ? a.selectedIndex : null,
        isCorrect:
          typeof a?.isCorrect === "boolean" ? a.isCorrect : null,
      }))
    }

    const collection = await getMcqResultsCollection()
    const now = new Date()

    await collection.updateOne(
      {
        userId: new ObjectId(userId),
        deckId: deckObjectId,
      },
      {
        $set: {
          totalQuestions,
          correctCount,
          percent,
          score10,
          answers: normalizedAnswers,
          updatedAt: now,
        },
        $setOnInsert: {
          userId: new ObjectId(userId),
          deckId: deckObjectId,
          createdAt: now,
        },
      },
      { upsert: true },
    )

    return NextResponse.json({
      ok: true,
      createdAt: now.toISOString(),
    })
  } catch (error) {
    console.error("[MCQ_RESULTS][POST] error", error)
    return NextResponse.json(
      { error: "Không thể lưu kết quả" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    const deckId = req.nextUrl.searchParams.get("deckId")
    if (!deckId) {
      return NextResponse.json(
        { error: "Thiếu deckId" },
        { status: 400 },
      )
    }

    let deckObjectId: ObjectId
    try {
      deckObjectId = new ObjectId(deckId)
    } catch {
      return NextResponse.json(
        { error: "deckId không hợp lệ" },
        { status: 400 },
      )
    }

    const collection = await getMcqResultsCollection()
    await collection.deleteOne({
      userId: new ObjectId(userId),
      deckId: deckObjectId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[MCQ_RESULTS][DELETE] error", error)
    return NextResponse.json(
      { error: "Không thể xoá kết quả" },
      { status: 500 },
    )
  }
}
