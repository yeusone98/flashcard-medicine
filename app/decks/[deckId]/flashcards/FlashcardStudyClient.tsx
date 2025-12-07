"use client"

import * as React from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type ReviewRating = "hard" | "medium" | "easy"

const RATING_INTERVAL_MINUTES: Record<ReviewRating, number> = {
  hard: 5,
  medium: 15,
  easy: 30,
}

export interface FlashcardStudyItem {
  _id: string
  front: string
  back: string
  note?: string | null
}

interface FlashcardStudyClientProps {
  deckId: string
  deckName: string
  cards: FlashcardStudyItem[]
}

interface CardState {
  nextAvailableAt: number
  lastRating?: ReviewRating
}

export default function FlashcardStudyClient({
  deckId,
  deckName,
  cards,
}: FlashcardStudyClientProps) {
  const { toast } = useToast()

  const total = cards.length

  const [index, setIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [isFlipAnimating, setIsFlipAnimating] = useState(false) // 👉 control animate flip
  const [isReviewing, setIsReviewing] = useState(false)
  const [onlyHard, setOnlyHard] = useState(false)

  const [cardStates, setCardStates] = useState<Record<string, CardState>>(() =>
    Object.fromEntries(cards.map((c) => [c._id, { nextAvailableAt: 0 }])),
  )

  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      cards.map((c) => [c._id, c.note ? String(c.note) : ""]),
    ),
  )

  const [sessionStart] = useState(() => Date.now())
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set())

  // timer đếm thời gian học
  useEffect(() => {
    const id = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const current = useMemo(() => {
    if (total === 0) return null
    return cards[index]
  }, [cards, index, total])

  // đánh dấu đã xem
  useEffect(() => {
    if (!current?._id) return
    setSeenIds((prev) => {
      if (prev.has(current._id)) return prev
      const next = new Set(prev)
      next.add(current._id)
      return next
    })
  }, [current?._id])

  const currentNumber = index + 1
  const progressValue = total === 0 ? 0 : (currentNumber / total) * 100

  const ratedCount = useMemo(
    () =>
      cards.reduce(
        (acc, c) => acc + (cardStates[c._id]?.lastRating ? 1 : 0),
        0,
      ),
    [cards, cardStates],
  )

  const ratingStats = useMemo(() => {
    let hard = 0
    let medium = 0
    let easy = 0
    for (const c of cards) {
      const r = cardStates[c._id]?.lastRating
      if (r === "hard") hard++
      else if (r === "medium") medium++
      else if (r === "easy") easy++
    }
    return { hard, medium, easy }
  }, [cards, cardStates])

  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowMs - sessionStart) / 1000),
  )
  const elapsedMinutes = Math.floor(elapsedSeconds / 60)
  const elapsedRemainSeconds = elapsedSeconds % 60
  const elapsedLabel =
    elapsedMinutes > 0
      ? `${elapsedMinutes} phút ${elapsedRemainSeconds
        .toString()
        .padStart(2, "0")} giây`
      : `${elapsedRemainSeconds} giây`

  // lật thẻ – chỉ animate khi user bấm
  const handleFlip = useCallback(() => {
    if (!current) return
    setIsFlipAnimating(true)
    setShowBack((prev) => !prev)
  }, [current])

  // chọn thẻ tiếp theo (SRS + onlyHard)
  const goNext = useCallback(() => {
    if (total === 0) return
    const now = Date.now()

    let nextIndex = index
    for (let step = 1; step <= total; step++) {
      const candidate = (index + step) % total
      const candidateCard = cards[candidate]
      const state = cardStates[candidateCard._id]

      if (onlyHard && state?.lastRating !== "hard") continue

      const nextAvailableAt = state?.nextAvailableAt ?? 0
      if (nextAvailableAt > now) continue

      nextIndex = candidate
      break
    }

    if (nextIndex === index) {
      toast({
        title: "Chưa có thẻ nào tới giờ ôn lại",
        description: onlyHard
          ? "Chưa có thẻ nào được đánh là Khó sẵn sàng để ôn. Hãy học thêm hoặc tắt chế độ Chỉ thẻ Khó."
          : "Bạn có thể nghỉ vài phút rồi bấm Tiếp, hệ thống sẽ đưa lại các thẻ đã được đánh giá.",
      })
      return
    }

    // 👉 đổi thẻ: không animate flip
    setIsFlipAnimating(false)
    setShowBack(false)
    setIndex(nextIndex)
  }, [cards, cardStates, index, onlyHard, toast, total])

  const goPrev = useCallback(() => {
    if (total === 0) return
    if (index === 0) return

    if (!onlyHard) {
      // 👉 đổi thẻ: không animate flip
      setIsFlipAnimating(false)
      setShowBack(false)
      setIndex((prev) => (prev === 0 ? 0 : prev - 1))
      return
    }

    let prevIndex = index
    for (let step = 1; step <= index; step++) {
      const candidate = index - step
      const candidateCard = cards[candidate]
      const state = cardStates[candidateCard._id]
      if (state?.lastRating === "hard") {
        prevIndex = candidate
        break
      }
    }

    if (prevIndex !== index) {
      // 👉 đổi thẻ: không animate flip
      setIsFlipAnimating(false)
      setShowBack(false)
      setIndex(prevIndex)
    }
  }, [cards, cardStates, index, onlyHard, total])

  const resetStudy = () => {
    setIndex(0)
    setIsFlipAnimating(false)
    setShowBack(false)
    setCardStates(
      Object.fromEntries(cards.map((c) => [c._id, { nextAvailableAt: 0 }])),
    )
    setSeenIds(new Set())
  }

  // chấm mức độ
  const handleRating = useCallback(
    async (rating: ReviewRating) => {
      if (!current) return

      const intervalMinutes = RATING_INTERVAL_MINUTES[rating]
      const now = Date.now()
      const dueAtMs = now + intervalMinutes * 60 * 1000

      const currentState = cardStates[current._id]
      const alreadyRated = !!currentState?.lastRating
      const willAllBeRated =
        !alreadyRated && ratedCount + 1 >= total && total > 0

      try {
        setIsReviewing(true)

        setCardStates((prev) => ({
          ...prev,
          [current._id]: {
            nextAvailableAt: dueAtMs,
            lastRating: rating,
          },
        }))

        const res = await fetch(`/api/flashcards/${current._id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || "Không cập nhật được lịch ôn")
        }

        const serverMinutes: number =
          typeof data?.next?.intervalMinutes === "number"
            ? data.next.intervalMinutes
            : intervalMinutes

        const title =
          rating === "hard"
            ? "Đánh dấu: Khó"
            : rating === "medium"
              ? "Đánh dấu: Trung bình"
              : "Đánh dấu: Dễ"

        toast({
          title,
          description: `Thẻ này sẽ lặp lại sau khoảng ${serverMinutes} phút.`,
        })

        if (willAllBeRated) {
          toast({
            title: "Hoàn thành bộ thẻ 🎉",
            description:
              "Bạn đã chấm hết tất cả flashcard trong bộ này. Nếu tiếp tục học, các thẻ sẽ được đưa lại theo mốc 5 / 15 / 30 phút.",
          })
        }

        goNext()
      } catch (err: unknown) {
        const error =
          err instanceof Error
            ? err
            : new Error("Đã xảy ra lỗi khi chấm thẻ.")
        console.error(error)
        toast({
          variant: "destructive",
          title: "Lỗi khi chấm thẻ",
          description: error.message || "Vui lòng thử lại.",
        })
      } finally {
        setIsReviewing(false)
      }
    },
    [cardStates, current, goNext, ratedCount, toast, total],
  )

  // toggle chỉ thẻ Khó
  const handleToggleOnlyHard = () => {
    setOnlyHard((prev) => {
      const next = !prev
      if (next) {
        const firstHardIndex = cards.findIndex(
          (c) => cardStates[c._id]?.lastRating === "hard",
        )
        if (firstHardIndex === -1) {
          toast({
            title: "Chưa có thẻ Khó",
            description:
              "Hãy học và đánh một số thẻ là Khó trước, sau đó bật chế độ này để ôn lại.",
          })
          return prev
        }
        setIndex(firstHardIndex)
        setIsFlipAnimating(false)
        setShowBack(false)
      }
      return next
    })
  }

  // ghi chú
  const handleNoteChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    if (!current) return
    const value = event.target.value
    setNotes((prev) => ({
      ...prev,
      [current._id]: value,
    }))
  }

  const handleNoteBlur = async () => {
    if (!current) return
    const noteValue = notes[current._id] ?? ""

    try {
      const res = await fetch(`/api/flashcards/${current._id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteValue }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Không lưu được ghi chú")
      }

      toast({
        title: "Đã lưu ghi chú",
        description: "Ghi chú cho thẻ này đã được lưu.",
      })
    } catch (err: unknown) {
      const error =
        err instanceof Error
          ? err
          : new Error("Đã xảy ra lỗi khi lưu ghi chú.")
      console.error(error)
      toast({
        variant: "destructive",
        title: "Lỗi khi lưu ghi chú",
        description: error.message || "Vui lòng thử lại.",
      })
    }
  }

  // phím tắt
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return

      if (event.key === " ") {
        event.preventDefault()
        handleFlip()
        return
      }

      if (event.key === "1") {
        event.preventDefault()
        void handleRating("hard")
        return
      }

      if (event.key === "2") {
        event.preventDefault()
        void handleRating("medium")
        return
      }

      if (event.key === "3") {
        event.preventDefault()
        void handleRating("easy")
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goPrev()
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        goNext()
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [goNext, goPrev, handleFlip, handleRating])

  if (total === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium">
          Bộ thẻ này chưa có flashcard nào.
        </p>
        <p className="text-sm text-muted-foreground">
          Hãy import hoặc tạo flashcard trước khi bắt đầu học.
        </p>
      </div>
    )
  }

  const currentNote = current ? notes[current._id] ?? "" : ""
  const seenCount = seenIds.size

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Học flashcard –{" "}
            <span className="text-emerald-300">{deckName}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Space để lật thẻ · 1/2/3 để chấm Khó / Trung bình / Dễ.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            Thẻ hiện tại:{" "}
            <span className="font-medium text-foreground">
              {currentNumber}/{total}
            </span>
          </span>
          <span>
            Đã chấm:{" "}
            <span className="font-medium text-foreground">
              {ratedCount}/{total}
            </span>
          </span>
          <span className="hidden md:inline">
            Thời gian:{" "}
            <span className="font-medium text-foreground">
              {elapsedLabel}
            </span>
          </span>
        </div>
      </header>

      {/* Progress */}
      <div className="space-y-1">
        <Progress value={progressValue} className="h-1.5" />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Tiến độ bộ thẻ</span>
          <span>{Math.round(progressValue)}%</span>
        </div>
      </div>

      {/* Layout 2 cột */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2.1fr)_minmax(260px,1fr)]">
        {/* Cột trái */}
        <div className="space-y-4">
          {/* Điều khiển trên card */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goPrev}
                disabled={index === 0 || isReviewing}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span>
                Thẻ {currentNumber}/{total}
              </span>

              {/* Mũi tên phải */}
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={goNext}
                disabled={isReviewing}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="inline-flex items-center gap-1 text-[11px]"
              onClick={resetStudy}
              disabled={isReviewing}
            >
              <RefreshCcw className="h-3 w-3" />
              Làm lại
            </Button>
          </div>

          {/* CARD + FLIP 3D */}
          <Card className="relative overflow-visible border-none bg-transparent shadow-none">
            <CardContent className="relative px-0 py-0">
              <div className="h-[320px] w-full [perspective:1400px] md:h-[360px]">
                <motion.div
                  className="relative h-full w-full rounded-3xl border border-emerald-600/40 bg-gradient-to-br from-emerald-950 via-slate-950 to-slate-950 shadow-2xl shadow-emerald-900/60"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: showBack ? 180 : 0 }}
                  initial={false}
                  transition={
                    isFlipAnimating
                      ? { duration: 0.5, ease: "easeInOut" }
                      : { duration: 0 } // 👉 đổi thẻ: không animate
                  }
                  onClick={handleFlip}
                >
                  {/* layer ánh sáng */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.22),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(16,185,129,0.22),_transparent_55%)]" />

                  {/* FRONT */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 text-center text-slate-50"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(0deg)",
                    }}
                  >
                    <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-emerald-300/80">
                      Mặt trước
                    </p>
                    <p className="whitespace-pre-line text-lg font-medium leading-relaxed md:text-xl">
                      {current?.front}
                    </p>
                    <p className="mt-4 text-[11px] text-emerald-200/80">
                      Nhấn vào thẻ hoặc Space để lật
                    </p>
                  </div>

                  {/* BACK */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 text-center text-slate-50"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-emerald-300/80">
                      Mặt sau
                    </p>
                    <p className="whitespace-pre-line text-lg font-medium leading-relaxed md:text-xl">
                      {current?.back}
                    </p>
                    <p className="mt-4 text-[11px] text-emerald-200/80">
                      Nhấn vào thẻ hoặc Space để lật lại
                    </p>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {/* Rating + phím tắt */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span className="text-xs text-muted-foreground">
              Đánh giá thẻ:
            </span>
            <div className="grid flex-1 grid-cols-3 gap-2 md:max-w-md">
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
                onClick={() => void handleRating("hard")}
              >
                Khó · 5&apos; (1)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center border-amber-400/70 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                onClick={() => void handleRating("medium")}
              >
                Trung bình · 15&apos; (2)
              </Button>
              <Button
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                onClick={() => void handleRating("easy")}
              >
                Dễ · 30&apos; (3)
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Phím tắt: Space = lật thẻ · 1 = Khó (5&apos;) · 2 = Trung bình
            (15&apos;) · 3 = Dễ (30&apos;) · ← / → = lùi / tiến.
          </p>

          {/* Ghi chú */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Ghi chú cá nhân cho thẻ này
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                className="min-h-[90px] w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none ring-0 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Ví dụ: mẹo nhớ, phân biệt với bệnh khác, bẫy đề thi…"
                value={currentNote}
                onChange={handleNoteChange}
                onBlur={void handleNoteBlur}
              />
              <p className="text-[11px] text-muted-foreground">
                Ghi chú được lưu riêng cho từng thẻ.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar phải */}
        <div className="space-y-4">
          {/* Danh sách thẻ */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Danh sách thẻ</CardTitle>
                  <p className="text-[11px] text-muted-foreground">
                    Nhấn số để chuyển nhanh tới thẻ.
                  </p>
                </div>
                <Button
                  variant={onlyHard ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={handleToggleOnlyHard}
                  disabled={isReviewing}
                >
                  {onlyHard ? "Đang lọc: Khó" : "Chỉ thẻ Khó"}
                </Button>
              </div>
              <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-destructive" /> Khó
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> TB
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Dễ
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[260px] pr-1">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-4">
                  {cards.map((card, idx) => {
                    const state = cardStates[card._id]
                    const rating = state?.lastRating
                    const isCurrent = idx === index

                    const baseClasses =
                      "h-8 w-full rounded-md border text-[11px] flex items-center justify-center transition-colors"

                    let ratingClasses =
                      "border-border/60 bg-background text-muted-foreground"

                    if (rating === "hard") {
                      ratingClasses =
                        "border-destructive/70 bg-destructive/10 text-destructive-foreground"
                    } else if (rating === "medium") {
                      ratingClasses =
                        "border-amber-400/70 bg-amber-400/10 text-amber-100"
                    } else if (rating === "easy") {
                      ratingClasses =
                        "border-emerald-400/70 bg-emerald-400/10 text-emerald-100"
                    }

                    const currentClasses = isCurrent
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-50"
                      : "hover:border-emerald-400 hover:text-emerald-100"

                    return (
                      <button
                        key={card._id}
                        type="button"
                        className={cn(
                          baseClasses,
                          ratingClasses,
                          currentClasses,
                        )}
                        onClick={() => {
                          setOnlyHard(false)
                          setIndex(idx)
                          setIsFlipAnimating(false)
                          setShowBack(false)
                        }}
                      >
                        {idx + 1}
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Thống kê phiên học</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Đã xem</span>
                <span className="font-medium text-foreground">
                  {seenCount}/{total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Đã chấm</span>
                <span className="font-medium text-foreground">
                  {ratedCount}/{total}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="rounded-md bg-destructive/10 px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wide text-destructive">
                    Khó
                  </p>
                  <p className="text-xs font-semibold text-destructive-foreground">
                    {ratingStats.hard}
                  </p>
                </div>
                <div className="rounded-md bg-amber-400/10 px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wide text-amber-200">
                    Trung bình
                  </p>
                  <p className="text-xs font-semibold text-amber-50">
                    {ratingStats.medium}
                  </p>
                </div>
                <div className="rounded-md bg-emerald-400/10 px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-200">
                    Dễ
                  </p>
                  <p className="text-xs font-semibold text-emerald-50">
                    {ratingStats.easy}
                  </p>
                </div>
              </div>

              <div className="pt-1">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Thời gian học
                </p>
                <p className="text-xs font-medium text-foreground">
                  {elapsedLabel}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
