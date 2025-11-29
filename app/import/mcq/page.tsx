// app/import/mcq/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card"

export default function ImportMCQPage() {
    const [file, setFile] = useState<File | null>(null)
    const [deckName, setDeckName] = useState("")
    const [deckDescription, setDeckDescription] = useState("")
    const [message, setMessage] = useState("")
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) return

        setLoading(true)
        setMessage("")

        const formData = new FormData()
        formData.append("file", file)
        formData.append("deckName", deckName)
        formData.append("deckDescription", deckDescription)

        const res = await fetch("/api/import/mcq", {
            method: "POST",
            body: formData,
        })
        const data = await res.json()
        setLoading(false)

        if (!res.ok) {
            setMessage(`Lỗi: ${data.error || "Import thất bại"}`)
            return
        }

        setMessage(`Import thành công ${data.importedCount} câu hỏi!`)
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-8">
            <div className="mb-4 flex items-center gap-2">
                <Button asChild variant="ghost" size="icon">
                    <Link href="/import">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight">
                    Import MCQ (.docx)
                </h1>
            </div>

            <Card className="bg-card">
                <CardHeader>
                    <CardTitle className="text-base">Import câu hỏi trắc nghiệm</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        File .docx định dạng Q: / A: / Correct: sẽ được chuyển thành các câu
                        hỏi trắc nghiệm.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Tên deck</label>
                            <input
                                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                                value={deckName}
                                onChange={(e) => setDeckName(e.target.value)}
                                placeholder="VD: Sinh lý – Huyết áp (MCQ)"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Mô tả deck</label>
                            <textarea
                                className="h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
                                value={deckDescription}
                                onChange={(e) => setDeckDescription(e.target.value)}
                                placeholder="VD: Bộ câu hỏi trắc nghiệm huyết áp, tim mạch..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">File .docx</label>
                            <input
                                type="file"
                                accept=".docx"
                                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading || !file}
                        >
                            {loading ? "Đang import..." : "Import MCQ"}
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
