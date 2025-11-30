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
import { useToast } from "@/hooks/use-toast"

export default function ImportMCQPage() {
    const [deckName, setDeckName] = useState("")
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const { toast } = useToast()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!file || !deckName.trim()) {
            const desc = "Vui lòng nhập tên deck và chọn file."
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

            const formData = new FormData()
            formData.append("file", file)
            formData.append("deckName", deckName.trim())

            const res = await fetch("/api/import/mcq", {
                method: "POST",
                body: formData,
            })

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(data?.error || "Import MCQ thất bại")
            }

            // reset form
            const name = deckName.trim()
            setDeckName("")
            setFile(null)

            setMessage("Import MCQ thành công.")

            toast({
                title: "Import MCQ thành công",
                description: `Deck "${name}" đã được tạo/import thành công.`,
            })
        } catch (error: any) {
            console.error(error)
            const desc = error?.message || "Đã xảy ra lỗi, vui lòng thử lại."
            setMessage(desc)

            toast({
                variant: "destructive",
                title: "Import MCQ thất bại",
                description: desc,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col gap-4 px-4 py-6">
            <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="icon" className="-ml-2">
                    <Link href="/import">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-lg font-semibold tracking-tight">
                    Import câu hỏi trắc nghiệm (MCQ)
                </h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Import MCQ từ file .docx</CardTitle>
                    <CardDescription>
                        File Word phải đúng format MCQ (Q:, A:, B:, C:, Đáp án:, Giải thích: ...).
                    </CardDescription>
                </CardHeader>

                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div className="space-y-1">
                            <label
                                htmlFor="deckName"
                                className="text-sm font-medium leading-none"
                            >
                                Tên bộ câu hỏi
                            </label>
                            <input
                                id="deckName"
                                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 focus-visible:border-primary"
                                placeholder="VD: HK2 – Y học môi trường – MCQ"
                                value={deckName}
                                onChange={(e) => setDeckName(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-1">
                            <label
                                htmlFor="file"
                                className="text-sm font-medium leading-none"
                            >
                                File .docx
                            </label>
                            <input
                                id="file"
                                type="file"
                                accept=".docx"
                                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
                                disabled={loading}
                                onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null
                                    setFile(f)
                                }}
                            />
                        </div>

                        <Button type="submit" disabled={loading || !file}>
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
