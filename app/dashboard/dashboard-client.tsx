// app/dashboard/dashboard-client.tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpenCheck, ListChecks, RefreshCw, LifeBuoy } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

interface DashboardSummary {
  totalDecks: number
  totalFlashcards: number
  totalQuestions: number
  dueFlashcards: number
  dueQuestions: number
  reviewedFlashcardsToday: number
  reviewedQuestionsToday: number
}

interface DashboardDeck {
  _id: string
  name: string
  subject?: string
  totalFlashcards: number
  dueFlashcards: number
  totalQuestions: number
  dueQuestions: number
  lastReviewedAt: string | null
  lastMcqScore10: number | null
  lastMcqPercent: number | null
  lastMcqAt: string | null
}

interface DashboardSubject {
  name: string
  isUnassigned: boolean
  deckCount: number
  totalFlashcards: number
  dueFlashcards: number
  totalQuestions: number
  dueQuestions: number
  newPerDayMin: number
  newPerDayMax: number
  reviewPerDayMin: number
  reviewPerDayMax: number
}

interface DashboardResponse {
  summary: DashboardSummary
  decks: DashboardDeck[]
  subjects: DashboardSubject[]
}

export default function DashboardClient() {
  const { toast } = useToast()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/dashboard")
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || "Không thể tải dashboard")
      }
      const json = (await res.json()) as DashboardResponse
      setData(json)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải dashboard"
      toast({
        variant: "destructive",
        title: "Tải dashboard thất bại",
        description: message,
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const sortedDecks = useMemo(() => {
    if (!data?.decks) return []
    return [...data.decks].sort((a, b) => {
      const dueA = a.dueFlashcards + a.dueQuestions
      const dueB = b.dueFlashcards + b.dueQuestions
      return dueB - dueA
    })
  }, [data])

  const sortedSubjects = useMemo(() => {
    if (!data?.subjects) return []
    return [...data.subjects]
  }, [data])

  const formatLimit = (min: number, max: number) =>
    min === max ? `${min}` : `${min}-${max}`

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 stagger">
        <p className="text-sm text-muted-foreground">Đang tải dashboard...</p>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 stagger">
        <p className="text-sm text-muted-foreground">Không có dữ liệu dashboard.</p>
      </main>
    )
  }

  const { summary } = data
  const dueTotal = summary.dueFlashcards + summary.dueQuestions
  const reviewedToday = summary.reviewedFlashcardsToday + summary.reviewedQuestionsToday

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 stagger">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BookOpenCheck className="h-3 w-3" />
            </span>
            <span>Dashboard hôm nay</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Hôm nay cần học
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Theo dõi số lượng flashcard &amp; MCQ đến hạn, thống kê hôm nay và hành động nhanh cho từng deck.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/help">
              <LifeBuoy className="mr-2 h-4 w-4" />
              Hướng dẫn
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={loadDashboard}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Làm mới
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Flashcards hôm nay</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {summary.dueFlashcards} / {summary.totalFlashcards} thẻ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={summary.totalFlashcards ? (summary.dueFlashcards / summary.totalFlashcards) * 100 : 0}
            />
            <p className="text-xs text-muted-foreground">
              Tổng {summary.totalFlashcards} thẻ trong tất cả deck.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">MCQ hôm nay</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {summary.dueQuestions} / {summary.totalQuestions} câu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={summary.totalQuestions ? (summary.dueQuestions / summary.totalQuestions) * 100 : 0}
            />
            <p className="text-xs text-muted-foreground">
              Tổng {summary.totalQuestions} câu hỏi trong tất cả deck.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tiến độ hôm nay</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Đã ôn {reviewedToday} mục
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-semibold text-primary">{dueTotal}</div>
            <p className="text-xs text-muted-foreground">
              Mục đến hạn hôm nay (flashcard + MCQ).
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Tổng quan theo môn</h2>
          <Badge variant="outline" className="text-[11px]">
            {sortedSubjects.length} môn
          </Badge>
        </div>

        {sortedSubjects.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Chưa có môn học nào.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sortedSubjects.map((subject) => {
              const dueTotal = subject.dueFlashcards + subject.dueQuestions
              const totalItems = subject.totalFlashcards + subject.totalQuestions
              return (
                <Card key={subject.name} className="border-border/70 bg-card/80">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{subject.name}</CardTitle>
                      <Badge
                        variant={dueTotal > 0 ? "default" : "outline"}
                        className="text-[11px]"
                      >
                        {dueTotal > 0 ? `${dueTotal} cần học` : "Không có mục đến hạn"}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-muted-foreground">
                      {subject.deckCount} deck - {totalItems} muc
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs text-muted-foreground">
                    <div className="grid gap-1 sm:grid-cols-2">
                      <div>
                        Flashcards:{" "}
                        <strong className="text-foreground">
                          {subject.dueFlashcards}
                        </strong>{" "}
                        / {subject.totalFlashcards}
                      </div>
                      <div>
                        MCQ:{" "}
                        <strong className="text-foreground">
                          {subject.dueQuestions}
                        </strong>{" "}
                        / {subject.totalQuestions}
                      </div>
                    </div>
                    <p>
                      Giới hạn học đang áp dụng (new/review):{" "}
                      <strong className="text-foreground">
                        {formatLimit(subject.newPerDayMin, subject.newPerDayMax)}
                      </strong>
                      {" / "}
                      <strong className="text-foreground">
                        {formatLimit(
                          subject.reviewPerDayMin,
                          subject.reviewPerDayMax,
                        )}
                      </strong>
                      {subject.newPerDayMin !== subject.newPerDayMax ||
                      subject.reviewPerDayMin !== subject.reviewPerDayMax
                        ? " (các deck trong môn đang khác nhau)"
                        : ""}
                    </p>
                    <div className="pt-1">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={
                            subject.isUnassigned
                              ? "/decks"
                              : `/decks?subject=${encodeURIComponent(subject.name)}`
                          }
                        >
                          Xem deck theo môn
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Deck cần ưu tiên</h2>
          <Badge variant="outline" className="text-[11px]">
            {summary.totalDecks} deck
          </Badge>
        </div>

        {sortedDecks.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Chưa có deck nào trong hệ thống.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedDecks.map((deck) => {
              const dueFlash = deck.dueFlashcards
              const dueQ = deck.dueQuestions
              const dueTotalDeck = dueFlash + dueQ

              return (
                <Card key={deck._id} className="border-border/70 bg-card/80">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">
                          <Link href={`/decks/${deck._id}`} className="hover:text-primary">
                            {deck.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          {deck.subject ? `Môn: ${deck.subject}` : "Chưa gán môn"}
                        </CardDescription>
                      </div>
                      <Badge variant={dueTotalDeck > 0 ? "default" : "outline"} className="text-[11px]">
                        {dueTotalDeck > 0 ? `${dueTotalDeck} cần học` : "Không có thẻ đến hạn"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        Flashcards: <strong className="text-foreground">{dueFlash}</strong> / {deck.totalFlashcards}
                      </div>
                      <div>
                        MCQ: <strong className="text-foreground">{dueQ}</strong> / {deck.totalQuestions}
                      </div>
                      {deck.lastMcqScore10 !== null && (
                        <div>
                          Điểm MCQ gần nhất: <strong className="text-foreground">{deck.lastMcqScore10.toFixed(1)}</strong> / 10
                        </div>
                      )}
                      {deck.lastReviewedAt && (
                        <div>
                          Ôn gần nhất: <span className="text-foreground">{new Date(deck.lastReviewedAt).toLocaleString("vi-VN")}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/decks/${deck._id}/flashcards?mode=due`}>
                          <BookOpenCheck className="mr-1 h-4 w-4" />
                          Flashcards hôm nay
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/decks/${deck._id}/mcq?mode=due`}>
                          <ListChecks className="mr-1 h-4 w-4" />
                          MCQ hôm nay
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/decks/${deck._id}/edit`}>Chỉnh sửa</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
