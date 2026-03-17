"use client"

import * as React from "react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import RichContent from "@/components/rich-content"

type ReviewRating = "again" | "hard" | "good" | "easy"

export interface FlashcardStudyItem {
  _id: string
  front: string
  back: string
  frontImage?: string | null
  backImage?: string | null
  frontAudio?: string | null
  backAudio?: string | null
  fields?: Record<string, string> | null
  dueAt?: string | null
  reviewRating?: string | null
  note?: string | null
}

interface FlashcardStudyClientProps {
  deckId: string
  deckName: string
  mode: string
  subject?: string
  cards: FlashcardStudyItem[]
  studyLimitInfo?: {
    newPerDay: number
    reviewPerDay: number
    dueBeforeLimit: number
    dueAfterLimit: number
  } | null
}

interface CardState {
  nextAvailableAt: number
}

export default function FlashcardStudyClient({
  deckId,
  deckName,
  mode,
  subject,
  cards,
  studyLimitInfo,
}: FlashcardStudyClientProps) {
  const { toast } = useToast()

  const total = cards.length

  const [index, setIndex] = useState(0)
  const [showBack, setShowBack] = useState(false)
  const [isFlipAnimating, setIsFlipAnimating] = useState(false) // 👉 control animate flip
  const [isReviewing, setIsReviewing] = useState(false)
  const [onlyHard, setOnlyHard] = useState(false)
  const [lightbox, setLightbox] = useState<{
    src: string
    alt: string
  } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)

  const initialCardStates = useMemo(
    () =>
      Object.fromEntries(
        cards.map((c) => [
          c._id,
          { nextAvailableAt: c.dueAt ? new Date(c.dueAt).getTime() : 0 },
        ]),
      ),
    [cards],
  )

  const [cardStates, setCardStates] = useState<Record<string, CardState>>(
    () => initialCardStates,
  )
  const [sessionRatings, setSessionRatings] = useState<
    Record<string, ReviewRating | undefined>
  >({})

  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      cards.map((c) => [c._id, c.note ? String(c.note) : ""]),
    ),
  )

  useEffect(() => {
    setCardStates(initialCardStates)
    setSessionRatings({})
    setNotes(
      Object.fromEntries(
        cards.map((c) => [c._id, c.note ? String(c.note) : ""]),
      ),
    )
    setSeenIds(new Set())
    setIndex(0)
    setShowBack(false)
    setIsFlipAnimating(false)

    if (typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(
          `flashcards:${deckId}:${mode}`,
        )
        if (stored) {
          const parsed = JSON.parse(stored) as { cardId?: string }
          if (parsed?.cardId) {
            const foundIndex = cards.findIndex(
              (c) => c._id === parsed.cardId,
            )
            if (foundIndex >= 0) {
              setIndex(foundIndex)
            }
          }
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [cards, deckId, initialCardStates, mode])

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

  useEffect(() => {
    if (!current?._id) return
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(
        `flashcards:${deckId}:${mode}`,
        JSON.stringify({ cardId: current._id }),
      )
    } catch {
      // ignore storage errors
    }
  }, [current?._id, deckId, mode])
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
        (acc, c) => acc + (sessionRatings[c._id] ? 1 : 0),
        0,
      ),
    [cards, sessionRatings],
  )

  const ratingStats = useMemo(() => {
    let again = 0
    let hard = 0
    let good = 0
    let easy = 0
    for (const c of cards) {
      const r = sessionRatings[c._id]
      if (r === "again") again++
      else if (r === "hard") hard++
      else if (r === "good") good++
      else if (r === "easy") easy++
    }
    return { again, hard, good, easy }
  }, [cards, sessionRatings])

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

      if (onlyHard && sessionRatings[candidateCard._id] !== "hard") continue

      const nextAvailableAt = state?.nextAvailableAt ?? 0
      if (mode === "due" && nextAvailableAt > now) continue

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
  }, [cards, cardStates, index, mode, onlyHard, sessionRatings, toast, total])

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
      if (sessionRatings[candidateCard._id] === "hard") {
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
  }, [cards, cardStates, index, onlyHard, sessionRatings, total])

  const resetStudy = () => {
    setIndex(0)
    setIsFlipAnimating(false)
    setShowBack(false)
    setCardStates(initialCardStates)
    setSessionRatings({})
    setSeenIds(new Set())
  }

  // chấm mức độ
  const handleRating = useCallback(
    async (rating: ReviewRating) => {
      if (!current) return

      const now = Date.now()

      const alreadyRated = !!sessionRatings[current._id]
      const willAllBeRated =
        !alreadyRated && ratedCount + 1 >= total && total > 0

      try {
        setIsReviewing(true)

        setSessionRatings((prev) => ({ ...prev, [current._id]: rating }))

        const res = await fetch(`/api/flashcards/${current._id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || "Could not update schedule")
        }

        const serverDays: number =
          typeof data?.next?.intervalDays === "number"
            ? data.next.intervalDays
            : 1

        const dueAtIso = data?.next?.dueAt
        const dueAtMs = dueAtIso ? new Date(dueAtIso).getTime() : now

        setCardStates((prev) => ({
          ...prev,
          [current._id]: {
            nextAvailableAt: dueAtMs,
          },
        }))

        const title =
          rating === "again"
            ? "Đã chấm: Lại"
            : rating === "hard"
              ? "Đã chấm: Khó"
              : rating === "good"
                ? "Đã chấm: Tốt"
                : "Đã chấm: Dễ"

        const intervalLabel =
          serverDays <= 1 ? "ngày mai" : `sau ${serverDays} ngày`

        toast({
          title,
          description: `Thẻ này sẽ quay lại ${intervalLabel}.`,
        })

        if (willAllBeRated) {
          toast({
            title: "Hoàn thành phiên học",
            description:
              "Bạn đã chấm tất cả thẻ trong phiên này. Thẻ đến hạn sẽ quay lại theo lịch FSRS.",
          })
        }

        goNext()
      } catch (err: unknown) {
        const error =
          err instanceof Error
            ? err
            : new Error("Không thể chấm thẻ.")
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
    [cardStates, current, goNext, ratedCount, toast, total, sessionRatings],
  )


  // toggle chỉ thẻ Khó
  const handleToggleOnlyHard = () => {
    setOnlyHard((prev) => {
      const next = !prev
      if (next) {
        const firstHardIndex = cards.findIndex(
          (c) => sessionRatings[c._id] === "hard",
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
        void handleRating("again")
        return
      }

      if (event.key === "2") {
        event.preventDefault()
        void handleRating("hard")
        return
      }

      if (event.key === "3") {
        event.preventDefault()
        void handleRating("good")
        return
      }

      if (event.key === "4") {
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

  const openImage = useCallback((src: string, alt: string) => {
    setLightbox({ src, alt })
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const clampZoom = (value: number) => Math.min(3, Math.max(1, value))

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.2 : -0.2
    setZoom((prev) => clampZoom(prev + delta))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLImageElement>) => {
    event.preventDefault()
    setIsPanning(true)
    isPanningRef.current = true
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLImageElement>) => {
    if (!isPanningRef.current) return
    const dx = event.clientX - lastPointerRef.current.x
    const dy = event.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLImageElement>) => {
    setIsPanning(false)
    isPanningRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (total === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-medium">Chưa có flashcard nào.</p>
        <p className="text-sm text-muted-foreground">
          {mode === "due"
            ? "Hôm nay chưa có thẻ đến hạn. Chuyển sang Tất cả hoặc Tổng ôn để xem toàn bộ."
            : "Hãy import hoặc tạo flashcard trước khi học."}
        </p>
        {mode === "due" && studyLimitInfo ? (
          <p className="max-w-xl rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Chế độ Hôm nay dùng giới hạn học: mới {studyLimitInfo.newPerDay}/ngày, ôn{" "}
            {studyLimitInfo.reviewPerDay}/ngày.
          </p>
        ) : null}
      </div>
    )
  }

  const currentNote = current ? notes[current._id] ?? "" : ""
  const seenCount = seenIds.size

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <nav className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Link
              href={
                subject
                  ? `/decks?subject=${encodeURIComponent(subject)}`
                  : "/decks"
              }
              className="hover:text-foreground"
            >
              Decks
            </Link>
            <span>/</span>
            <Link
              href={
                subject
                  ? `/decks/${deckId}?subject=${encodeURIComponent(subject)}`
                  : `/decks/${deckId}`
              }
              className="hover:text-foreground"
            >
              {deckName}
            </Link>
            <span>/</span>
            <span className="text-foreground">Flashcards</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight">
            Flashcards -{" "}
            <span className="text-primary">{deckName}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            Space = lật thẻ · 1 = Lại · 2 = Khó · 3 = Tốt · 4 = Dễ
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              variant={mode === "due" ? "default" : "outline"}
            >
              <Link
                href={`/decks/${deckId}/flashcards?mode=due${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
              >
                Hôm nay
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={mode === "all" ? "default" : "outline"}
            >
              <Link
                href={`/decks/${deckId}/flashcards?mode=all${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
              >
                Tất cả
              </Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={mode === "mix" ? "default" : "outline"}
            >
              <Link
                href={`/decks/${deckId}/flashcards?mode=mix${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
              >
                Tổng ôn
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={
                  subject
                    ? `/decks/${deckId}/edit?subject=${encodeURIComponent(subject)}`
                    : `/decks/${deckId}/edit`
                }
              >
                Chỉnh sửa
              </Link>
            </Button>
          </div>
          {mode === "due" && studyLimitInfo ? (
            <p className="max-w-3xl rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
              `Today` đang áp dụng giới hạn học: mới {studyLimitInfo.newPerDay}
              /ngày, ôn {studyLimitInfo.reviewPerDay}/ngày. Hiện hiển thị{" "}
              {studyLimitInfo.dueAfterLimit}/{studyLimitInfo.dueBeforeLimit} thẻ
              đến hạn.
              {studyLimitInfo.dueBeforeLimit > studyLimitInfo.dueAfterLimit
                ? ` (${studyLimitInfo.dueBeforeLimit - studyLimitInfo.dueAfterLimit} thẻ đang bị giới hạn theo cài đặt).`
                : ""}
              {" "}
              <Link
                href={
                  subject
                    ? `/decks/${deckId}?subject=${encodeURIComponent(subject)}`
                    : `/decks/${deckId}`
                }
                className="underline underline-offset-2 hover:text-foreground"
              >
                Chỉnh trong Tùy chọn học
              </Link>
              .
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            Thẻ: <span className="font-medium text-foreground">{currentNumber}/{total}</span>
          </span>
          <span>
            Đã chấm: <span className="font-medium text-foreground">{ratedCount}/{total}</span>
          </span>
          <span className="hidden md:inline">
            Thời gian: <span className="font-medium text-foreground">{elapsedLabel}</span>
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
                  className="relative h-full w-full rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-slate-950 to-slate-950 shadow-2xl shadow-[0_30px_60px_-50px_hsl(var(--primary)/0.55)] dark:from-primary/15 dark:via-slate-950 dark:to-slate-950 from-primary/10 via-white to-slate-50"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: showBack ? 180 : 0 }}
                  initial={false}
                  transition={
                    isFlipAnimating
                      ? { duration: 0.5, ease: "easeInOut" }
                      : { duration: 0 } // 👉 đổi thẻ: không animate
                  }
                  onClick={handleFlip}
                  role="button"
                  tabIndex={0}
                  aria-label={showBack ? "Lật về mặt trước" : "Lật xem mặt sau"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFlip()
                  }}
                >
                  {/* layer ánh sáng */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_top,_rgba(14,165,164,0.22),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(14,165,164,0.18),_transparent_55%)]" />

                  {/* FRONT */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 text-center text-foreground dark:text-slate-50"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(0deg)",
                    }}
                  >
                    <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-primary/80">
                      Mặt trước
                    </p>
                    {current?.frontImage ? (
                      <button
                        type="button"
                        className="group"
                        onClick={() =>
                          openImage(current.frontImage || "", "Flashcard front")
                        }
                      >
                        <img
                          src={current.frontImage}
                          alt="Flashcard front"
                          className="mb-4 max-h-40 w-auto max-w-full rounded-xl border border-primary/30 object-contain shadow-lg transition group-hover:opacity-90 cursor-zoom-in"
                        />
                      </button>
                    ) : null}
                    <RichContent
                      content={current?.front}
                      fields={current?.fields ?? undefined}
                      className="text-lg font-medium leading-relaxed md:text-xl"
                    />
                    {current?.frontAudio ? (
                      <div className="mt-3 w-full max-w-sm">
                        <audio controls className="w-full">
                          <source src={current.frontAudio} />
                        </audio>
                      </div>
                    ) : null}
                    <p className="mt-4 text-[11px] text-primary/70">
                      Nhấn vào thẻ hoặc Space để lật
                    </p>
                  </div>

                  {/* BACK */}
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center px-6 py-8 text-center text-foreground dark:text-slate-50"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-primary/80">
                      Mặt sau
                    </p>
                    {current?.backImage ? (
                      <button
                        type="button"
                        className="group"
                        onClick={() =>
                          openImage(current.backImage || "", "Flashcard back")
                        }
                      >
                        <img
                          src={current.backImage}
                          alt="Flashcard back"
                          className="mb-4 max-h-40 w-auto max-w-full rounded-xl border border-primary/30 object-contain shadow-lg transition group-hover:opacity-90 cursor-zoom-in"
                        />
                      </button>
                    ) : null}
                    <RichContent
                      content={current?.back}
                      fields={current?.fields ?? undefined}
                      revealCloze
                      className="text-lg font-medium leading-relaxed md:text-xl"
                    />
                    {current?.backAudio ? (
                      <div className="mt-3 w-full max-w-sm">
                        <audio controls className="w-full">
                          <source src={current.backAudio} />
                        </audio>
                      </div>
                    ) : null}
                    <p className="mt-4 text-[11px] text-primary/70">
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
            <div className="grid flex-1 grid-cols-4 gap-2 md:max-w-lg">
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center border-red-500/60 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                onClick={() => void handleRating("again")}
              >
                Lại (1)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20"
                onClick={() => void handleRating("hard")}
              >
                Khó (2)
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center border-amber-400/70 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20"
                onClick={() => void handleRating("good")}
              >
                Tốt (3)
              </Button>
              <Button
                size="sm"
                disabled={isReviewing || !current}
                className="justify-center bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => void handleRating("easy")}
              >
                Dễ (4)
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Phím tắt: Space = lật thẻ · 1 = Lại · 2 = Khó · 3 = Tốt · 4 = Dễ · ← / → = lùi / tiến.
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
                className="min-h-[90px] w-full rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-0 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
                placeholder="Ví dụ: mẹo nhớ, phân biệt với bệnh khác, bẫy đề thi…"
                value={currentNote}
                onChange={handleNoteChange}
                onBlur={handleNoteBlur}
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
                  <span className="h-2 w-2 rounded-full bg-primary" /> Dễ
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[260px] pr-1">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-4">
                  {cards.map((card, idx) => {
                    const rating = sessionRatings[card._id]
                    const isCurrent = idx === index

                    const baseClasses =
                      "h-8 w-full rounded-md border text-[11px] flex items-center justify-center transition-colors"

                    let ratingClasses =
                      "border-border/60 bg-background text-muted-foreground"

                    if (rating === "again") {
                      ratingClasses =
                        "border-red-500/70 bg-red-500/10 text-red-400"
                    } else if (rating === "hard") {
                      ratingClasses =
                        "border-destructive/70 bg-destructive/10 text-destructive-foreground"
                    } else if (rating === "good") {
                      ratingClasses =
                        "border-amber-400/70 bg-amber-400/10 text-amber-100"
                    } else if (rating === "easy") {
                      ratingClasses =
                        "border-primary/60 bg-primary/10 text-primary"
                    }

                    const currentClasses = isCurrent
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "hover:border-primary/60 hover:text-primary"

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

              <div className="grid grid-cols-4 gap-2 pt-1">
                <div className="rounded-md bg-red-500/10 px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wide text-red-400">
                    Lại
                  </p>
                  <p className="text-xs font-semibold text-red-300">
                    {ratingStats.again}
                  </p>
                </div>
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
                    Tốt
                  </p>
                  <p className="text-xs font-semibold text-amber-50">
                    {ratingStats.good}
                  </p>
                </div>
                <div className="rounded-md bg-primary/10 px-2 py-1">
                  <p className="text-[10px] uppercase tracking-wide text-primary/80">
                    Dễ
                  </p>
                  <p className="text-xs font-semibold text-primary">
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

      <Dialog
        open={Boolean(lightbox)}
        onOpenChange={(open) => {
          if (!open) {
            setLightbox(null)
            setZoom(1)
            setPan({ x: 0, y: 0 })
            setIsPanning(false)
            isPanningRef.current = false
          }
        }}
      >
        <DialogContent className="w-[95vw] max-w-5xl border-border/70 bg-background/95 backdrop-blur">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm text-foreground">
              {lightbox?.alt || "Hình ảnh"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setZoom((prev) => clampZoom(prev - 0.2))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setZoom((prev) => clampZoom(prev + 0.2))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setZoom(1)
                  setPan({ x: 0, y: 0 })
                }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div
            className="flex max-h-[75vh] items-center justify-center overflow-hidden rounded-xl bg-muted/40 p-4"
            onWheel={handleWheelZoom}
          >
            {lightbox?.src ? (
              <img
                src={lightbox.src}
                alt={lightbox.alt}
                draggable={false}
                className={cn(
                  "max-h-[70vh] w-auto max-w-full select-none touch-none",
                  isPanning ? "cursor-grabbing" : "cursor-grab",
                )}
                style={{
                  transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
