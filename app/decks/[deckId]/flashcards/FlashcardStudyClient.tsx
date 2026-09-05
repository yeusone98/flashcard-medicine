"use client"

import * as React from "react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import {
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
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
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { reviewIntervalLabel } from "@/lib/study-time"
import { StudyDisclosure, StudyFocusToggle, useStudyFocus } from "@/components/study-layout"
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

type CardFaceDensity = "balanced" | "dense" | "compact"

const HTML_TAG_REGEX = /<[^>]+>/g
const MULTI_SPACE_REGEX = /\s+/g

function getFaceDensity(
  content: string | null | undefined,
  options?: { hasImage?: boolean; hasAudio?: boolean },
): CardFaceDensity {
  const raw = String(content ?? "")
  const plainText = raw
    .replace(HTML_TAG_REGEX, " ")
    .replace(MULTI_SPACE_REGEX, " ")
    .trim()
  const lineBreaks = raw.split(/\r?\n/).length - 1
  const score =
    plainText.length +
    lineBreaks * 28 +
    (options?.hasImage ? 160 : 0) +
    (options?.hasAudio ? 110 : 0)

  if (score > 780) return "compact"
  if (score > 360) return "dense"
  return "balanced"
}

function getFaceContentClassName(density: CardFaceDensity) {
  if (density === "compact") {
    return "font-reading max-w-[56rem] text-left text-[0.95rem] font-medium leading-[1.78] md:text-[1.08rem]"
  }

  if (density === "dense") {
    return "font-reading max-w-[52rem] text-left text-[1rem] font-medium leading-[1.72] md:text-[1.18rem]"
  }

  return "font-reading max-w-3xl text-center text-[1.12rem] font-medium leading-[1.68] md:text-[1.55rem]"
}

function getFaceStackClassName(density: CardFaceDensity) {
  return density === "balanced"
    ? "justify-center"
    : "justify-start pt-1 md:pt-2"
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
  const { focused, toggle } = useStudyFocus()
  const reviewLock = useRef(false)
  const pendingReview = useRef<{ id: string; rating: ReviewRating; requestId: string } | null>(null)
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
    if (total === 0 || pendingReview.current) return null
    return cards[index]
  }, [cards, index, total])

  const frontDensity = useMemo(
    () =>
      getFaceDensity(current?.front, {
        hasImage: Boolean(current?.frontImage),
        hasAudio: Boolean(current?.frontAudio),
      }),
    [current?.front, current?.frontAudio, current?.frontImage],
  )

  const backDensity = useMemo(
    () =>
      getFaceDensity(current?.back, {
        hasImage: Boolean(current?.backImage),
        hasAudio: Boolean(current?.backAudio),
      }),
    [current?.back, current?.backAudio, current?.backImage],
  )

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

  const ratedCount = useMemo(
    () =>
      cards.reduce(
        (acc, c) => acc + (sessionRatings[c._id] ? 1 : 0),
        0,
      ),
    [cards, sessionRatings],
  )

  const progressValue = total === 0 ? 0 : (ratedCount / total) * 100

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
  const reduceMotion = useReducedMotion()
  const handleFlip = useCallback(() => {
    if (!current) return
    setIsFlipAnimating(true)
    setShowBack((prev) => !prev)
  }, [current])

  // chọn thẻ tiếp theo (SRS + onlyHard)
  const goNext = useCallback((silent = false) => {
    if (total === 0 || pendingReview.current) return
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
      if (silent) return
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
    if (total === 0 || pendingReview.current) return
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
    if (reviewLock.current || pendingReview.current) return
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
      if (!current || reviewLock.current) return
      if (pendingReview.current && pendingReview.current.id !== current._id) return
      reviewLock.current = true
      pendingReview.current ??= { id: current._id, rating, requestId: crypto.randomUUID() }
      const pending = pendingReview.current
      rating = pending.rating

      const now = Date.now()

      const alreadyRated = !!sessionRatings[current._id]
      const willAllBeRated =
        !alreadyRated && ratedCount + 1 >= total && total > 0

      try {
        setIsReviewing(true)

        const res = await fetch(`/api/flashcards/${current._id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating, requestId: pending.requestId }),
        })

        const data = await res.json().catch(() => null)

        if (!res.ok) {
          throw new Error(data?.error || "Could not update schedule")
        }

        setSessionRatings((prev) => ({ ...prev, [current._id]: rating }))
        pendingReview.current = null

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
          reviewIntervalLabel(data.next.intervalMinutes)

        goNext(true)
        toast({
          title: willAllBeRated ? "Đã chấm tất cả thẻ trong phiên" : title,
          description: `Đã lưu đánh giá. Thẻ này sẽ quay lại ${intervalLabel}.`,
        })

      } catch (err: unknown) {
        const error =
          err instanceof Error
            ? err
            : new Error("Không thể chấm thẻ.")
        console.error(error)
        toast({
          variant: "destructive",
          title: "Lỗi khi chấm thẻ",
          description: `${error.message} Bấm chấm thẻ lần nữa để thử lưu lại đánh giá vừa chọn.`,
        })
      } finally {
        reviewLock.current = false
        setIsReviewing(false)
      }
    },
    [cardStates, current, goNext, ratedCount, toast, total, sessionRatings],
  )


  // toggle chỉ thẻ Khó
  const handleToggleOnlyHard = () => {
    if (pendingReview.current) return
    if (!onlyHard) {
      // Đang bật chức năng lọc thẻ Khó
      const firstHardIndex = cards.findIndex(
        (c) => sessionRatings[c._id] === "hard",
      )
      if (firstHardIndex === -1) {
        toast({
          title: "Chưa có thẻ Khó",
          description:
            "Hãy học và đánh một số thẻ là Khó trước, sau đó bật chế độ này để ôn lại.",
        })
        return
      }
      setOnlyHard(true)
      setIndex(firstHardIndex)
      setIsFlipAnimating(false)
      setShowBack(false)
    } else {
      // Tắt chức năng lọc
      setOnlyHard(false)
    }
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
        description: `${error.message} Bấm chấm thẻ lần nữa để thử lưu lại đánh giá vừa chọn.`,
      })
    }
  }

  // phím tắt
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || reviewLock.current) return
      const target = event.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return

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
            : "Hãy nhập dữ liệu hoặc tạo thẻ trước khi học."}
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
    <div data-study-focus={focused} className="study-page flashcard-workspace min-w-0 flex flex-col gap-5 pb-8">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/decks/${deckId}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Bộ thẻ</Link>
        <StudyFocusToggle focused={focused} onToggle={toggle} />
      </div>
      {/* Header */}
      <header className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0 space-y-3">
          <nav className="study-secondary flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <Link
              href={
                subject
                  ? `/decks?subject=${encodeURIComponent(subject)}`
                  : "/decks"
              }
              className="hover:text-foreground"
            >
              Bộ thẻ
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
            <span className="text-foreground">Thẻ ghi nhớ</span>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere]">
            Ôn thẻ ·{" "}
            <span className="text-primary">{deckName}</span>
          </h1>

          <div className="study-secondary flex flex-wrap items-center gap-2">
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
            <p className="study-secondary rounded-lg bg-muted/30 px-3 py-2 leading-relaxed text-[11px] text-muted-foreground">
              Hôm nay đang áp dụng giới hạn học: mới {studyLimitInfo.newPerDay}
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
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs tabular-nums text-muted-foreground">
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
          <span>Thẻ đã chấm trong phiên</span>
          <span>{Math.round(progressValue)}%</span>
        </div>
      </div>

      {/* Layout 2 cột */}
      <div className={cn("study-columns grid min-w-0 items-start gap-5", !focused && "lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]")}>
        {/* Cột trái */}
        <div className="min-w-0 space-y-4">
          {/* Điều khiển trên card */}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11"
                aria-label="Thẻ trước"
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
                className="h-11 w-11"
                aria-label="Thẻ tiếp theo"
                onClick={() => goNext()}
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
              <div className="study-flashcard h-[360px] min-w-0 w-full [perspective:1400px] md:h-[400px] xl:h-[420px]">
                <motion.div
                  className="study-reading relative h-full w-full rounded-2xl border border-border shadow-sm"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{ rotateY: showBack ? 180 : 0 }}
                  initial={false}
                  transition={
                    isFlipAnimating
                      ? { duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }
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


                  {/* FRONT */}
                  <div
                    className="absolute inset-0 flex flex-col px-5 py-6 text-foreground dark:text-slate-50 md:px-7 md:py-7"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(0deg)",
                    }}
                  >
                    <p className="mb-3 shrink-0 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                      Mặt trước
                    </p>
                    <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-1">
                      <div
                        className={cn(
                          "mx-auto flex min-h-full w-full flex-col items-center gap-4",
                          getFaceStackClassName(frontDensity),
                        )}
                      >
                        {current?.frontImage ? (
                          <button
                            type="button"
                            className="group shrink-0"
                            onClick={() =>
                              openImage(current.frontImage || "", "Flashcard front")
                            }
                          >
                            <img
                              src={current.frontImage}
                              alt="Flashcard front"
                              className="max-h-32 w-auto max-w-full rounded-xl border border-primary/30 object-contain shadow-lg transition group-hover:opacity-90 cursor-zoom-in md:max-h-40"
                            />
                          </button>
                        ) : null}
                        <RichContent
                          content={current?.front}
                          fields={current?.fields ?? undefined}
                          className={getFaceContentClassName(frontDensity)}
                        />
                        {current?.frontAudio ? (
                          <div className="w-full max-w-sm shrink-0">
                            <audio controls className="w-full">
                              <source src={current.frontAudio} />
                            </audio>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 shrink-0 text-center text-[11px] text-muted-foreground">
                      Nhấn vào thẻ hoặc Space để lật
                    </p>
                  </div>

                  {/* BACK */}
                  <div
                    className="absolute inset-0 flex flex-col px-5 py-6 text-foreground dark:text-slate-50 md:px-7 md:py-7"
                    style={{
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <p className="mb-3 shrink-0 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
                      Mặt sau
                    </p>
                    <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-1">
                      <div
                        className={cn(
                          "mx-auto flex min-h-full w-full flex-col items-center gap-4",
                          getFaceStackClassName(backDensity),
                        )}
                      >
                        {current?.backImage ? (
                          <button
                            type="button"
                            className="group shrink-0"
                            onClick={() =>
                              openImage(current.backImage || "", "Flashcard back")
                            }
                          >
                            <img
                              src={current.backImage}
                              alt="Flashcard back"
                              className="max-h-32 w-auto max-w-full rounded-xl border border-primary/30 object-contain shadow-lg transition group-hover:opacity-90 cursor-zoom-in md:max-h-40"
                            />
                          </button>
                        ) : null}
                        <RichContent
                          content={current?.back}
                          fields={current?.fields ?? undefined}
                          revealCloze
                          className={getFaceContentClassName(backDensity)}
                        />
                        {current?.backAudio ? (
                          <div className="w-full max-w-sm shrink-0">
                            <audio controls className="w-full">
                              <source src={current.backAudio} />
                            </audio>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-4 shrink-0 text-center text-[11px] text-muted-foreground">
                      Nhấn vào thẻ hoặc Space để lật lại
                    </p>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {/* Rating + phím tắt */}
          <div className="study-ratings flex flex-col gap-2 rounded-2xl border border-border bg-background p-3">
            <span role="status" className="flex min-h-4 items-center gap-2 text-xs text-muted-foreground">
              {isReviewing ? <><Loader2 aria-hidden="true" className="h-3 w-3 animate-spin motion-reduce:animate-none" />Đang lưu đánh giá…</> : "Đánh giá thẻ:"}
            </span>
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="rating-button rating-again"
                onClick={() => void handleRating("again")}
              >
                <span>Lại</span><kbd className="hidden text-xs font-normal opacity-80 sm:inline">1</kbd>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="rating-button rating-hard"
                onClick={() => void handleRating("hard")}
              >
                <span>Khó</span><kbd className="hidden text-xs font-normal opacity-80 sm:inline">2</kbd>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isReviewing || !current}
                className="rating-button rating-good"
                onClick={() => void handleRating("good")}
              >
                <span>Tốt</span><kbd className="hidden text-xs font-normal opacity-80 sm:inline">3</kbd>
              </Button>
              <Button
                size="sm"
                disabled={isReviewing || !current}
                className="rating-button rating-easy"
                onClick={() => void handleRating("easy")}
              >
                <span>Dễ</span><kbd className="hidden text-xs font-normal opacity-80 sm:inline">4</kbd>
              </Button>
            </div>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Phím tắt: Space = lật thẻ · 1 = Lại · 2 = Khó · 3 = Tốt · 4 = Dễ · ← / → = lùi / tiến.
          </p>

          {/* Ghi chú */}
          <StudyDisclosure title="Ghi chú cá nhân">
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
          </StudyDisclosure>
        </div>

        {/* Sidebar phải */}
        <aside className={cn("study-sidebar min-w-0 space-y-4", focused && "hidden")}>
          <StudyDisclosure title="Danh sách thẻ & thống kê" defaultOpen>
          {/* Danh sách thẻ */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
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
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rating-again rounded-md border px-2 py-1">Lại</span>
                <span className="rating-hard rounded-md border px-2 py-1">Khó</span>
                <span className="rating-good rounded-md border px-2 py-1">Tốt</span>
                <span className="rating-easy rounded-md border px-2 py-1">Dễ</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
                <div className="grid grid-cols-5 gap-2">
                  {cards.map((card, idx) => {
                    const rating = sessionRatings[card._id]
                    const isCurrent = idx === index

                    const baseClasses =
                      "h-10 min-w-0 w-full rounded-lg border text-xs flex items-center justify-center transition-colors"

                    let ratingClasses =
                      "border-border/60 bg-background text-muted-foreground"

                    if (rating) ratingClasses = `rating-${rating}`

                    const currentClasses = isCurrent
                      ? "ring-2 ring-inset ring-foreground font-semibold"
                      : "hover:border-primary/60 hover:text-primary"

                    return (
                      <button
                        key={card._id}
                        type="button"
                        aria-label={`Đến thẻ ${idx + 1}`}
                        aria-current={isCurrent ? "step" : undefined}
                        disabled={isReviewing}
                        className={cn(
                          baseClasses,
                          ratingClasses,
                          currentClasses,
                        )}
                        onClick={() => {
                          if (pendingReview.current) return
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
              </div>
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

              <div className="grid grid-cols-2 gap-2 pt-1">
                {([['again', 'Lại'], ['hard', 'Khó'], ['good', 'Tốt'], ['easy', 'Dễ']] as const).map(([rating, label]) => (
                  <div key={rating} className={`rating-${rating} rounded-lg border px-2 py-2 text-center`}>
                    <p className="text-xs">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{ratingStats[rating]}</p>
                  </div>
                ))}
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
          </StudyDisclosure>
        </aside>
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
