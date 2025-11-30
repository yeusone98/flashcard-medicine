// app/import/manual-json/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Code2 } from "lucide-react"
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

export default function ImportManualJsonPage() {
    const [jsonText, setJsonText] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        let payload: unknown

        try {
            payload = JSON.parse(jsonText)
        } catch (err) {
            const desc = "JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp."
            setMessage(desc)
            toast({
                variant: "destructive",
                title: "Lỗi JSON",
                description: desc,
            })
            return
        }

        try {
            setLoading(true)
            setMessage(null)

            const res = await fetch("/api/import/manual-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(data?.error || "Import thất bại")
            }

            const desc = `Đã tạo deck mới với ${data.flashcardCount ?? 0} flashcard và ${data.questionCount ?? 0} câu trắc nghiệm.`

            setJsonText("")
            setMessage(desc)

            toast({
                title: "Import JSON thành công",
                description: desc,
            })
        } catch (error: any) {
            console.error(error)
            const desc = error?.message || "Đã xảy ra lỗi, vui lòng thử lại."
            setMessage(desc)
            toast({
                variant: "destructive",
                title: "Import thất bại",
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
                    Import từ JSON (tự tạo)
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Code2 className="h-5 w-5" />
                        Dán JSON flashcard + trắc nghiệm
                    </CardTitle>
                    <CardDescription>
                        Dùng ChatGPT để sinh JSON theo format{" "}
                        <code>{`{ deckName, description?, flashcards?, questions? }`}</code>{" "}
                        rồi dán vào đây để tạo deck mới.
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-1">
                            <label
                                htmlFor="json"
                                className="text-sm font-medium leading-none"
                            >
                                JSON nội dung deck
                            </label>
                            <textarea
                                id="json"
                                className="mt-1 h-80 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none ring-0 focus-visible:border-primary"
                                placeholder={`{\n  "deckName": "Theo dõi kiểm báo trong mổ – Nhiệt độ & SpO2",\n  "description": "Ôn tập nhiệt độ, SpO2, thán đồ, ECG, HA...",\n  "flashcards": [ { "front": "...", "back": "..." } ],\n  "questions": [ { "question": "...", "choices": [ ... ], "explanation": "..." } ]\n}`}
                                value={jsonText}
                                onChange={(e) => setJsonText(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <Button type="submit" disabled={loading || !jsonText.trim()}>
                            {loading ? "Đang import..." : "Import JSON"}
                        </Button>
                    </form>
                </CardContent>

                <CardFooter>
                    {message && (
                        <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {message}
                        </p>
                    )}
                </CardFooter>
            </Card>
        </main>
    )
}
