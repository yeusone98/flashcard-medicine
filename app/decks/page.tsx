// app/decks/page.tsx
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { getDecksCollection } from "@/lib/mongodb"
import { DecksPageClient } from "./decks-page-client"

export default async function DecksPage() {
    // 🔒 bắt buộc đăng nhập
    const session = await auth()
    if (!session?.user) {
        redirect("/login")
    }

    // lấy dữ liệu deck từ MongoDB
    const decksCol = await getDecksCollection()
    const decks = await decksCol.find({}).sort({ createdAt: -1 }).toArray()

    // Chuyển ObjectId + Date sang string để truyền xuống client
    const data = decks.map((d) => ({
        _id: d._id?.toString() ?? "",
        name: d.name,
        description: d.description ?? "",
        subject: d.subject ?? "",
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
    }))

    return <DecksPageClient initialDecks={data} />
}
