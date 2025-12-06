// app/api/deck-parents/route.ts
import { NextResponse } from "next/server"
import { getDecksCollection } from "@/lib/mongodb"

export const runtime = "nodejs"

export async function GET() {
  try {
    const decksCol = await getDecksCollection()

    // ✨ Lấy toàn bộ giá trị distinct của field "subject"
    const rawSubjects = (await decksCol.distinct("subject")) as (string | null)[]

    // ✨ Lọc bỏ null/undefined/chuỗi rỗng ở phía JS
    const parents = rawSubjects
      .filter((v): v is string => typeof v === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .sort((a, b) => a.localeCompare(b, "vi"))

    return NextResponse.json({ parents })
  } catch (error) {
    console.error("Error in /api/deck-parents", error)
    return NextResponse.json(
      { error: "Không lấy được danh sách parent deck" },
      { status: 500 },
    )
  }
}
