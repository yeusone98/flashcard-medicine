// app/import/notes-ai/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function ImportNotesAIPage() {
    const [deckName, setDeckName] = useState("")
    const [notes, setNotes] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!deckName.trim() || !notes.trim()) {
            const desc = "Vui lòng nhập tên deck và dán nội dung ghi chú."
            setMessage(desc)
            toast({
                variant: "destructive",
                title: "Thiếu thông tin",
                description: desc,
            })
            return
        }

        try {
            setLoading(true)
            setMessage(null)

            const res = await fetch("/api/import/notes-ai", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deckName: deckName.trim(),
                    notes: notes.trim(),
                }),
            })

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(data?.error || "Generate thất bại")
            }

            const desc = `Đã tạo deck mới với ${data.flashcardCount ?? 0} flashcard và ${data.questionCount ?? 0} câu trắc nghiệm.`

            setDeckName("")
            setNotes("")
            setMessage(desc)

            toast({
                title: "Tạo bộ thẻ từ notes thành công",
                description: desc,
            })
        } catch (error: any) {
            console.error(error)
            const desc = error?.message || "Đã xảy ra lỗi, vui lòng thử lại."
            setMessage(desc)

            toast({
                variant: "destructive",
                title: "Generate thất bại",
                description: desc,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col gap-4 px-4 py-6">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon" className="-ml-2">
                    <Link href="/import">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight">
                    Tạo bộ thẻ từ ghi chú (Notion / Markdown)
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-yellow-400" />
                        Generate flashcard + trắc nghiệm tự động
                    </CardTitle>
                    <CardDescription>
                        Export Notion &rarr; Markdown &amp; CSV, mở file <code>.md</code>,
                        copy nội dung và dán vào đây. Hệ thống sẽ tạo bộ flashcard và câu hỏi
                        trắc nghiệm giúp bạn.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-1">
                            <label
                                htmlFor="deckName"
                                className="text-sm font-medium leading-none"
                            >
                                Tên bộ thẻ
                            </label>
                            <input
                                id="deckName"
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 focus-visible:border-primary"
                                placeholder="VD: Theo dõi kiểm báo trong mổ – Nhiệt độ & SpO₂"
                                value={deckName}
                                onChange={(e) => setDeckName(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-1">
                            <label
                                htmlFor="notes"
                                className="text-sm font-medium leading-none"
                            >
                                Nội dung ghi chú (dán từ file .md của Notion)
                            </label>
                            <textarea
                                id="notes"
                                className="mt-1 h-72 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 focus-visible:border-primary"
                                placeholder={`# 1. Nhiệt độ\nTheo dõi nhiệt độ trung tâm là có giá trị nhất...\n\n## Các vị trí đo nhiệt độ trung tâm\n- Động mạch phổi...\n- Đầu xa thực quản...\n...`}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <Button type="submit" disabled={loading}>
                            {loading ? "Đang phân tích & tạo câu hỏi..." : "Generate bộ thẻ từ notes"}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter>
                    {message && (
                        <p className="text-sm text-muted-foreground">{message}</p>
                    )}
                </CardFooter>
            </Card>
        </main>
    )
}
