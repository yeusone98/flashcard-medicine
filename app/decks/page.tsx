// app/decks/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Layers, BookOpenCheck, ListChecks } from "lucide-react"

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Deck {
    _id: string
    name: string
    description?: string
    subject?: string
}

export default function DeckListPage() {
    const [decks, setDecks] = useState<Deck[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDecks = async () => {
            try {
                setLoading(true)
                const res = await fetch("/api/decks")
                const data = await res.json()
                setDecks(data)
            } catch (error) {
                console.error("Error loading decks", error)
            } finally {
                setLoading(false)
            }
        }

        fetchDecks()
    }, [])

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 md:py-8">
            {/* Header */}
            <section className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Layers className="h-3 w-3" />
                        </span>
                        <span>Danh sách bộ thẻ</span>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Chọn một deck để bắt đầu học
                    </h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Mỗi deck có thể dùng để học{" "}
                        <span className="font-medium text-primary">Flashcard</span> hoặc làm{" "}
                        <span className="font-medium text-primary">Trắc nghiệm</span>. Bạn
                        có thể import thêm dữ liệu ở màn hình Import.
                    </p>
                </div>

                <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
                    <Link href="/">Về trang chủ</Link>
                </Button>
            </section>

            {/* Nội dung */}
            <section className="flex-1">
                {loading ? (
                    <div className="flex h-[40vh] items-center justify-center">
                        <p className="text-sm text-muted-foreground">
                            Đang tải danh sách deck...
                        </p>
                    </div>
                ) : decks.length === 0 ? (
                    <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-center">
                        <p className="text-sm text-muted-foreground">
                            Hiện chưa có deck nào trong hệ thống.
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Hãy vào trang Import để thêm flashcard hoặc câu hỏi trắc nghiệm.
                        </p>
                        <Button asChild size="sm">
                            <Link href="/import">Đi tới Import</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {decks.map((deck, idx) => (
                            <motion.div
                                key={deck._id}
                                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.2, delay: idx * 0.03 }}
                            >
                                <Card className="flex h-full flex-col border-border/70 bg-card/80">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-1">
                                                <CardTitle className="text-base md:text-lg">
                                                    {deck.name}
                                                </CardTitle>
                                                <CardDescription className="text-xs md:text-sm">
                                                    {deck.description && deck.description.trim().length > 0
                                                        ? deck.description
                                                        : "Chưa có mô tả cho deck này."}
                                                </CardDescription>
                                            </div>
                                            {deck.subject && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[11px] uppercase tracking-tight"
                                                >
                                                    {deck.subject}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>

                                    <CardContent className="pb-3 text-xs text-muted-foreground">
                                        <p>Chọn cách học bên dưới:</p>
                                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                            <li>Ôn từng thẻ với hiệu ứng lật</li>
                                            <li>Làm trắc nghiệm, xem điểm và giải thích</li>
                                        </ul>
                                    </CardContent>

                                    <CardFooter className="mt-auto flex flex-col gap-2 border-t border-border/70 pt-3 text-xs">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button asChild size="sm" className="flex-1 gap-1">
                                                <Link href={`/decks/${deck._id}/flashcards`}>
                                                    <BookOpenCheck className="h-4 w-4" />
                                                    Học flashcard
                                                </Link>
                                            </Button>
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 gap-1"
                                            >
                                                <Link href={`/decks/${deck._id}/mcq`}>
                                                    <ListChecks className="h-4 w-4" />
                                                    Làm trắc nghiệm
                                                </Link>
                                            </Button>
                                        </div>
                                    </CardFooter>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </section>
        </main>
    )
}
