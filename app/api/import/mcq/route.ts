// app/api/import/mcq/route.ts
import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { parseMCFromText } from "@/lib/parsers"
import {
    getDecksCollection,
    getFlashcardsCollection,
    getQuestionsCollection,
} from "@/lib/mongodb"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null
        const deckName = formData.get("deckName")?.toString().trim() || ""
        const deckDescription =
            formData.get("deckDescription")?.toString().trim() || ""

        if (!file) {
            return NextResponse.json({ error: "Missing file" }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const result = await mammoth.extractRawText({ buffer })
        const text = result.value || ""

        const questions = parseMCFromText(text)

        if (!questions.length) {
            return NextResponse.json(
                {
                    error:
                        "Không tìm thấy câu trắc nghiệm nào (Q: / A:, hoặc định dạng MCQ hợp lệ).",
                },
                { status: 400 },
            )
        }

        const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
            getDecksCollection(),
            getFlashcardsCollection(),
            getQuestionsCollection(),
        ])

        const now = new Date()

        // Tạo deck dùng chung cho cả MCQ + Flashcard
        const deckInsert = await decksCol.insertOne({
            name: deckName || file.name.replace(/\.docx$/i, ""),
            description: deckDescription || undefined,
            createdAt: now,
            updatedAt: now,
        })
        const deckId = deckInsert.insertedId

        // Lưu câu hỏi trắc nghiệm
        const qDocs = questions.map((q) => ({
            deckId,
            question: q.question,
            choices: q.choices,
            explanation: q.explanation,
            level: 0,
            createdAt: now,
            updatedAt: now,
        }))

        if (qDocs.length) {
            await questionsCol.insertMany(qDocs)
        }

        // Lưu flashcard tương ứng (front = câu hỏi, back = đáp án đúng + giải thích)
        const fcDocs = questions.map((q) => {
            const correctChoice = q.choices.find((c) => c.isCorrect)?.text || ""

            let back = `Đáp án đúng: ${correctChoice}`
            if (q.explanation) {
                back += `\n\nGiải thích: ${q.explanation}`
            }

            return {
                deckId,
                front: q.question,
                back,
                level: 0,
                createdAt: now,
                updatedAt: now,
            }
        })

        if (fcDocs.length) {
            await flashcardsCol.insertMany(fcDocs)
        }

        return NextResponse.json({
            deckId: deckId.toString(),
            importedCount: questions.length,
        })
    } catch (error) {
        console.error("Error in /api/import/mcq", error)
        return NextResponse.json(
            { error: "Không thể import MCQ" },
            { status: 500 },
        )
    }
}
