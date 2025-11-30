// app/decks/decks-page-client.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import {
    Layers,
    BookOpenCheck,
    ListChecks,
    Trash2,
    Loader2,
} from "lucide-react"

import { useToast } from "@/hooks/use-toast"

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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

// Kiểu deck dùng chung với server
export type DeckItem = {
    _id: string
    name: string
    description?: string
    subject?: string
    createdAt: string
    updatedAt: string
}

export function DecksPageClient({ initialDecks }: { initialDecks: DeckItem[] }) {
    const [decks, setDecks] = useState<DeckItem[]>(initialDecks ?? [])
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const { toast } = useToast()

    async function handleDeleteDeck(deck: DeckItem) {
        try {
            setDeletingId(deck._id)

            const res = await fetch(`/api/decks/${deck._id}`, {
                method: "DELETE",
            })

            const body = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(body?.error || "Xoá deck thất bại")
            }

            setDecks((prev) => prev.filter((d) => d._id !== deck._id))

            toast({
                title: "Đã xoá bộ thẻ",
                description: `Bộ thẻ "${deck.name}" đã được xoá thành công.`,
            })
        } catch (error: any) {
            console.error(error)
            toast({
                variant: "destructive",
                title: "Xoá deck thất bại",
                description: error?.message || "Vui lòng thử lại sau.",
            })
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 md:py-8">
            {/* Header giống code cũ */}
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

                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="hidden md:inline-flex"
                >
                    <Link href="/">Về trang chủ</Link>
                </Button>
            </section>

            {/* Nội dung */}
            <section className="flex-1">
                {decks.length === 0 ? (
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

                                    <CardFooter className="mt-auto border-t border-border/70 pt-4">
                                        <div className="flex items-center gap-3">
                                            {/* Nút học flashcard */}
                                            <Button
                                                asChild
                                                size="default"
                                                className="flex-1 justify-center gap-2"
                                            >
                                                <Link href={`/decks/${deck._id}/flashcards`}>
                                                    <BookOpenCheck className="h-4 w-4" />
                                                    Học flashcard
                                                </Link>
                                            </Button>

                                            {/* Nút làm trắc nghiệm */}
                                            <Button
                                                asChild
                                                size="default"
                                                variant="outline"
                                                className="flex-1 justify-center gap-2"
                                            >
                                                <Link href={`/decks/${deck._id}/mcq`}>
                                                    <ListChecks className="h-4 w-4" />
                                                    Làm trắc nghiệm
                                                </Link>
                                            </Button>

                                            {/* Nút xoá deck + popup xác nhận */}
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="ml-1 shrink-0"
                                                        disabled={deletingId === deck._id}
                                                        aria-label={`Xoá deck ${deck.name}`}
                                                    >
                                                        {deletingId === deck._id ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-destructive dark:text-white" />
                                                        ) : (
                                                            <Trash2 className="h-4 w-4 text-destructive dark:text-white" />
                                                        )}
                                                    </Button>
                                                </AlertDialogTrigger>

                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>
                                                            Xoá bộ thẻ "{deck.name}"?
                                                        </AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Tất cả flashcard và câu hỏi trắc nghiệm liên quan
                                                            cũng sẽ bị xoá. Hành động này không thể hoàn tác.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Huỷ</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                            onClick={() => handleDeleteDeck(deck)}
                                                        >
                                                            Xoá
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
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
