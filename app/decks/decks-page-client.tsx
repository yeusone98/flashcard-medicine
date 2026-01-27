// app/decks/decks-page-client.tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  Layers,
  BookOpenCheck,
  ListChecks,
  Trash2,
  Loader2,
  Pencil,
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

  // 🔹 Đọc ?subject=... từ URL ở client
  const searchParams = useSearchParams()
  const subject = (searchParams.get("subject") ?? "").trim()

  // 🔹 Filter theo subject (nếu có)
  const displayDecks = useMemo(
    () =>
      subject
        ? decks.filter(
            (d) => (d.subject ?? "").trim() === subject,
          )
        : decks,
    [decks, subject],
  )

  const hasSubject = subject.length > 0

  const buildHref = (base: string, params?: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    if (subject) {
      search.set("subject", subject)
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) search.set(key, value)
      })
    }
    const query = search.toString()
    return query ? `${base}?${query}` : base
  }

  const title = hasSubject
    ? `Bộ thẻ – ${subject}`
    : "Chọn một deck để bắt đầu học"

  const descriptionText = hasSubject
    ? "Chỉ hiển thị các bộ thẻ thuộc môn/chủ đề được chọn."
    : "Mỗi deck có thể dùng để học Flashcard hoặc làm Trắc nghiệm. Bạn có thể import thêm dữ liệu ở màn hình Import."

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
    } catch (error) {
      console.error(error)
      let message = "Vui lòng thử lại sau."

      if (error instanceof Error) {
        message = error.message
      } else if (typeof error === "string") {
        message = error
      }

      toast({
        variant: "destructive",
        title: "Xoá deck thất bại",
        description: message,
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 md:py-8">
      {/* Header */}
      <section className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Layers className="h-3 w-3" />
            </span>
            <span>{hasSubject ? "Bộ thẻ theo môn học" : "Danh sách bộ thẻ"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {descriptionText}
          </p>
        </div>

        <Button
          asChild
          variant="outline"
          size="sm"
          className="hidden md:inline-flex"
        >
          <Link href={hasSubject ? "/decks" : "/"}>
            {hasSubject ? "Xem tất cả bộ thẻ" : "Về trang chủ"}
          </Link>
        </Button>
      </section>

      {/* Nội dung */}
      <section className="flex-1">
        {displayDecks.length === 0 ? (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              {hasSubject
                ? "Không có bộ thẻ nào thuộc môn/chủ đề này."
                : "Hiện chưa có deck nào trong hệ thống."}
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
            {displayDecks.map((deck, idx) => (
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
                          <Link
                            href={buildHref(`/decks/${deck._id}`)}
                            className="hover:text-primary"
                          >
                            {deck.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                          {deck.description && deck.description.trim().length > 0
                            ? deck.description
                            : "Chưa có mô tả cho deck này."}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {deck.subject && (
                          <Badge
                            variant="outline"
                            className="text-[11px] uppercase tracking-tight"
                          >
                            {deck.subject}
                          </Badge>
                        )}
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                        >
                          <Link href={buildHref(`/decks/${deck._id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
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
                        <Link
                          href={buildHref(`/decks/${deck._id}/flashcards`, {
                            mode: "due",
                          })}
                        >
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
                        <Link
                          href={buildHref(`/decks/${deck._id}/mcq`, {
                            mode: "due",
                          })}
                        >
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
                              Xoá bộ thẻ {deck.name}?
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
