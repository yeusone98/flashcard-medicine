// app/decks/[deckId]/mcq/page.tsx
"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type WheelEvent,
} from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import RichContent from "@/components/rich-content"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

interface Choice {
  text: string
  isCorrect: boolean
  image?: string
}

interface Question {
  _id: string
  question: string
  choices: Choice[]
  image?: string
  explanation?: string
}

interface AnswerState {
  selectedIndex: number | null
  isCorrect: boolean | null
}

type ReviewMode = "all" | "wrong"
type StudyMode = "due" | "all" | "mix"

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

interface DeckSummary {
  _id: string
  name?: string
  options?: {
    newPerDay?: number
    reviewPerDay?: number
  }
}

interface McqResult {
  totalQuestions: number
  correctCount: number
  percent: number
  score10: number
  createdAt: string
  answers: AnswerState[]
}

export default function MCQPage() {
  const params = useParams<{ deckId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const deckId = params.deckId
  const modeParam = searchParams.get("mode") ?? "due"
  const studyMode: StudyMode =
    modeParam === "mix" || modeParam === "all" || modeParam === "due"
      ? (modeParam as StudyMode)
      : "due"
  const subjectParam = searchParams.get("subject") ?? ""
  const subject = subjectParam.trim()

  const [questions, setQuestions] = useState<Question[]>([])
  const [order, setOrder] = useState<number[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerState[]>([])
  const [loading, setLoading] = useState(true)
  const [deckName, setDeckName] = useState("")
  const [studyLimits, setStudyLimits] = useState<{
    newPerDay: number
    reviewPerDay: number
  } | null>(null)

  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [reviewMode, setReviewMode] = useState<ReviewMode>("all")

  const [savedResult, setSavedResult] = useState<McqResult | null>(null)
  const [isSavingResult, setIsSavingResult] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)

  // Lấy deck name + câu hỏi MCQ + kết quả (nếu có)
  useEffect(() => {
    if (!deckId) return

    const fetchAll = async () => {
      try {
        setLoading(true)

        const questionMode = studyMode === "due" ? "due" : "all"
        const [deckRes, questionsRes, resultRes] = await Promise.all([
          fetch(`/api/decks/${deckId}`),
          fetch(`/api/questions?deckId=${deckId}&mode=${questionMode}`),
          fetch(`/api/mcq-results?deckId=${deckId}`),
        ])

        if (!deckRes.ok) {
          throw new Error("Không thể tải danh sách deck")
        }
        if (!questionsRes.ok) {
          throw new Error("Không thể tải câu hỏi trắc nghiệm")
        }

        const deck = (await deckRes.json()) as DeckSummary
        setDeckName(deck?.name ?? "")
        const parsedNewPerDay =
          typeof deck?.options?.newPerDay === "number" && Number.isFinite(deck.options.newPerDay)
            ? deck.options.newPerDay
            : 20
        const parsedReviewPerDay =
          typeof deck?.options?.reviewPerDay === "number" &&
          Number.isFinite(deck.options.reviewPerDay)
            ? deck.options.reviewPerDay
            : 200
        setStudyLimits({
          newPerDay: Math.max(0, Math.trunc(parsedNewPerDay)),
          reviewPerDay: Math.max(0, Math.trunc(parsedReviewPerDay)),
        })

        const questionsData = (await questionsRes.json()) as Question[]
        const normalizedQuestions = questionsData.map((q) => ({
          ...q,
          image:
            q.image ||
            (q as unknown as { imageUrl?: string }).imageUrl ||
            "",
          choices: Array.isArray(q.choices)
            ? q.choices.map((choice) => ({
                ...choice,
                image:
                  choice.image ||
                  (choice as unknown as { imageUrl?: string }).imageUrl ||
                  "",
              }))
            : [],
        }))


        let loadedResult: McqResult | null = null
        if (resultRes.ok) {
          type McqResultApiResponse = { result: McqResult | null }
          const resultJson = (await resultRes.json()) as McqResultApiResponse
          loadedResult = resultJson.result ?? null
        }

        setQuestions(normalizedQuestions)
        setIndex(0)
        setReviewMode("all")

        // Nếu có kết quả + có mảng answers trùng số câu → load lại màu luôn
        if (
          loadedResult &&
          Array.isArray(loadedResult.answers) &&
          loadedResult.answers.length === normalizedQuestions.length
        ) {
          setAnswers(loadedResult.answers)
          setIsSubmitted(true)
          setSavedResult(loadedResult)
        } else {
          // Không có kết quả chi tiết → reset như bài mới
          setAnswers(
            normalizedQuestions.map<AnswerState>(() => ({
              selectedIndex: null,
              isCorrect: null,
            })),
          )
          setIsSubmitted(false)
          setSavedResult(null)
        }
      } catch (error) {
        console.error(error)
        setIsSubmitted(false)
        setSavedResult(null)
        setStudyLimits(null)
      } finally {
        setLoading(false)
      }
    }

    void fetchAll()
  }, [deckId, studyMode])

  useEffect(() => {
    if (questions.length === 0) {
      setOrder([])
      setIndex(0)
      return
    }

    const baseOrder = questions.map((_, i) => i)
    let nextOrder = baseOrder

    if (studyMode === "mix" && typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem(`mcq-order:${deckId}`)
      if (stored) {
        try {
          const storedIds = JSON.parse(stored) as string[]
          const idToIndex = new Map(
            questions.map((q, idx) => [q._id, idx]),
          )
          const mapped = storedIds
            .map((id) => idToIndex.get(id))
            .filter((value): value is number => typeof value === "number")

          if (mapped.length === questions.length) {
            nextOrder = mapped
          }
        } catch {
          // ignore storage errors
        }
      }

      if (nextOrder === baseOrder) {
        nextOrder = shuffle(baseOrder)
      }

      try {
        const ids = nextOrder.map((idx) => questions[idx]?._id).filter(Boolean)
        window.sessionStorage.setItem(
          `mcq-order:${deckId}`,
          JSON.stringify(ids),
        )
      } catch {
        // ignore storage errors
      }
    }

    setOrder(nextOrder)

    if (typeof window !== "undefined") {
      try {
        const storedPos = window.sessionStorage.getItem(
          `mcq-pos:${deckId}:${studyMode}`,
        )
        const pos = storedPos ? Number(storedPos) : 0
        if (!Number.isNaN(pos) && pos >= 0 && pos < questions.length) {
          setIndex(pos)
        } else {
          setIndex(0)
        }
      } catch {
        setIndex(0)
      }
    } else {
      setIndex(0)
    }
  }, [deckId, studyMode, questions])

  const cancelSubmit = () => {
    setShowSubmitModal(false)
  }

  const total = questions.length
  const hasQuestions = total > 0

  const resolvedOrder = useMemo(() => {
    if (order.length === total) return order
    return questions.map((_, i) => i)
  }, [order, questions, total])

  const currentQuestionIndex = hasQuestions ? resolvedOrder[index] : null
  const current =
    currentQuestionIndex !== null && currentQuestionIndex !== undefined
      ? questions[currentQuestionIndex]
      : null

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.sessionStorage.setItem(
        `mcq-pos:${deckId}:${studyMode}`,
        String(index),
      )
    } catch {
      // ignore storage errors
    }
  }, [deckId, index, studyMode])

  const unansweredCount = answers.filter(a => a.selectedIndex === null).length
  const correctCount = answers.filter(a => a.isCorrect === true).length
  const answeredCount = total - unansweredCount

  const totalForDisplay = savedResult?.totalQuestions ?? total
  const correctForDisplay = savedResult?.correctCount ?? correctCount
  const answeredForDisplay =
    savedResult?.totalQuestions ?? answeredCount
  const percentForDisplay =
    savedResult?.percent ??
    (totalForDisplay
      ? Math.round((correctForDisplay / totalForDisplay) * 100)
      : 0)
  const score10ForDisplay =
    savedResult?.score10 ??
    (totalForDisplay ? (correctForDisplay / totalForDisplay) * 10 : 0)

  const progress = hasQuestions ? ((index + 1) / total) * 100 : 0

  // Lọc vị trí câu theo chế độ xem
  const getFilteredPositions = () => {
    if (!isSubmitted || reviewMode === "all") {
      return resolvedOrder.map((_, pos) => pos)
    }
    const wrongPositions: number[] = []
    resolvedOrder.forEach((questionIndex, pos) => {
      if (answers[questionIndex]?.isCorrect === false) {
        wrongPositions.push(pos)
      }
    })
    return wrongPositions
  }

  const filteredPositions = getFilteredPositions()
  const currentFilteredPos = filteredPositions.indexOf(index)
  const isFirstInView =
    filteredPositions.length === 0 ? true : currentFilteredPos <= 0
  const isLastInView =
    filteredPositions.length === 0
      ? true
      : currentFilteredPos === filteredPositions.length - 1

  const isPrevDisabled =
    !hasQuestions ||
    (!isSubmitted && index === 0) ||
    (isSubmitted && isFirstInView)
  const isNextDisabled = !hasQuestions || (isSubmitted && isLastInView)

  const positionsForList = filteredPositions

  const isLastQuestionBeforeSubmit =
    !isSubmitted && hasQuestions && index === total - 1

  const handleSelect = (choiceIndex: number) => {
    if (!current || isSubmitted) return
    if (currentQuestionIndex === null) return

    setAnswers(prev => {
      const copy = [...prev]
      const isCorrect = current.choices[choiceIndex]?.isCorrect ?? false
      copy[currentQuestionIndex] = { selectedIndex: choiceIndex, isCorrect }
      return copy
    })
  }

  const goToQuestion = (i: number) => {
    setIndex(i)
  }

  const nextQuestion = () => {
    if (!hasQuestions) return

    const filtered = getFilteredPositions()
    if (filtered.length === 0) return

    const pos = filtered.indexOf(index)
    if (pos === -1) {
      setIndex(filtered[0])
      return
    }

    const nextPos = Math.min(pos + 1, filtered.length - 1)
    setIndex(filtered[nextPos])
  }

  const prevQuestion = () => {
    if (!hasQuestions) return

    const filtered = getFilteredPositions()
    if (filtered.length === 0) return

    const pos = filtered.indexOf(index)
    if (pos === -1) {
      setIndex(filtered[0])
      return
    }

    const prevPos = Math.max(pos - 1, 0)
    setIndex(filtered[prevPos])
  }

  const handleMainButton = () => {
    if (!hasQuestions) return
    if (index < total - 1) {
      setIndex(prev => Math.min(prev + 1, total - 1))
    } else {
      setShowSubmitModal(true)
    }
  }

  const confirmSubmit = async () => {
    if (!hasQuestions) return

    setIsSubmitted(true)
    setShowSubmitModal(false)
    setReviewMode("all")

    const totalQuestions = total
    const correct = correctCount
    const computedPercent = totalQuestions
      ? Math.round((correct / totalQuestions) * 100)
      : 0
    const computedScore10 = totalQuestions
      ? (correct / totalQuestions) * 10
      : 0

    const baseResult: McqResult = {
      totalQuestions,
      correctCount: correct,
      percent: computedPercent,
      score10: computedScore10,
      answers: [...answers],
      createdAt: new Date().toISOString(),
    }

    setSavedResult(baseResult)

    const reviewUpdates = questions
      .map((q, idx) => ({
        id: q._id,
        isCorrect: answers[idx]?.isCorrect === true,
      }))
      .filter((item) => item.id)

    if (reviewUpdates.length > 0) {
      void Promise.allSettled(
        reviewUpdates.map((item) =>
          fetch(`/api/questions/${item.id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isCorrect: item.isCorrect }),
          }),
        ),
      )
    }

    if (!deckId) return

    try {
      setIsSavingResult(true)
      const res = await fetch("/api/mcq-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deckId,
          totalQuestions,
          correctCount: correct,
          percent: computedPercent,
          score10: computedScore10,
          answers,
        }),
      })

      if (res.ok) {
        const json = await res.json()
        if (json?.createdAt) {
          setSavedResult(prev =>
            prev
              ? { ...prev, createdAt: json.createdAt as string }
              : { ...baseResult, createdAt: json.createdAt as string },
          )
        }
      } else {
        console.error("Không thể lưu kết quả trắc nghiệm", await res.text())
      }
    } catch (error) {
      console.error("Lỗi lưu kết quả trắc nghiệm", error)
    } finally {
      setIsSavingResult(false)
    }
  }

  const resetQuiz = async () => {
    if (!hasQuestions) return

    setAnswers(
      questions.map(() => ({
        selectedIndex: null,
        isCorrect: null,
      })),
    )
    setIsSubmitted(false)
    setReviewMode("all")
    setIndex(0)
    setSavedResult(null)
    if (studyMode === "mix") {
      const baseOrder = questions.map((_, i) => i)
      const nextOrder = shuffle(baseOrder)
      setOrder(nextOrder)
      try {
        const ids = nextOrder.map((idx) => questions[idx]?._id).filter(Boolean)
        window.sessionStorage.setItem(
          `mcq-order:${deckId}`,
          JSON.stringify(ids),
        )
      } catch {
        // ignore storage errors
      }
    }

    if (!deckId) return

    try {
      await fetch(`/api/mcq-results?deckId=${deckId}`, {
        method: "DELETE",
      })
    } catch (error) {
      console.error("Không thể reset kết quả trắc nghiệm", error)
    }
  }

  const handleChangeReviewMode = (mode: ReviewMode) => {
    setReviewMode(mode)
    if (mode === "wrong" && isSubmitted) {
      const firstWrongPos = resolvedOrder.findIndex(
        (questionIndex) => answers[questionIndex]?.isCorrect === false,
      )
      if (firstWrongPos !== -1) {
        setIndex(firstWrongPos)
      }
    }
  }

  const mainButtonLabel = isSubmitted
    ? "Câu tiếp theo"
    : isLastQuestionBeforeSubmit
      ? "Nộp bài"
      : "Câu tiếp theo"

  const openImage = (src: string, alt: string) => {
    setLightbox({ src, alt })
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const clampZoom = (value: number) => Math.min(3, Math.max(1, value))

  const handleWheelZoom = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.2 : -0.2
    setZoom((prev) => clampZoom(prev + delta))
  }

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    event.preventDefault()
    setIsPanning(true)
    isPanningRef.current = true
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    if (!isPanningRef.current) return
    const dx = event.clientX - lastPointerRef.current.x
    const dy = event.clientY - lastPointerRef.current.y
    lastPointerRef.current = { x: event.clientX, y: event.clientY }
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
  }

  const handlePointerUp = (event: PointerEvent<HTMLImageElement>) => {
    setIsPanning(false)
    isPanningRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      // Bỏ qua nếu đang gõ vào input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (event.repeat) return

      // Chọn đáp án 1, 2, 3, 4 (A, B, C, D)
      if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault()
        const choiceIndex = parseInt(event.key, 10) - 1
        if (current && choiceIndex < current.choices.length) {
          handleSelect(choiceIndex)
        }
        return
      }

      // Enter để nộp bài hoặc chuyển câu tiếp
      if (event.key === "Enter") {
        event.preventDefault()
        if (isSubmitted) {
          if (!isNextDisabled) nextQuestion()
        } else {
          handleMainButton()
        }
        return
      }
      
      // Mũi tên trái / phải
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        if (!isPrevDisabled) prevQuestion()
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        if (!isSubmitted && !isNextDisabled) {
          handleMainButton()
        } else if (isSubmitted && !isNextDisabled) {
          nextQuestion()
        }
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [
    current,
    isSubmitted,
    isNextDisabled,
    isPrevDisabled,
    nextQuestion,
    prevQuestion,
    handleMainButton,
    handleSelect,
  ])

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col gap-6 px-4 py-6">
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
          {deckName || "Deck"}
        </Link>
        <span>/</span>
        <span className="text-foreground">MCQ</span>
      </nav>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              router.push(
                subject
                  ? `/decks/${deckId}?subject=${encodeURIComponent(subject)}`
                  : `/decks/${deckId}`,
              )
            }
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Trắc nghiệm
            </h1>
            <p className="text-xs text-muted-foreground">
              Chọn đáp án cho từng câu hỏi, làm đến câu cuối rồi nộp bài để xem
              điểm và giải thích.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                asChild
                size="sm"
                variant={studyMode === "due" ? "default" : "outline"}
              >
                <Link
                  href={`/decks/${deckId}/mcq?mode=due${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
                >
                  Hôm nay
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={studyMode === "all" ? "default" : "outline"}
              >
                <Link
                  href={`/decks/${deckId}/mcq?mode=all${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
                >
                  Tất cả
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant={studyMode === "mix" ? "default" : "outline"}
              >
                <Link
                  href={`/decks/${deckId}/mcq?mode=mix${subject ? `&subject=${encodeURIComponent(subject)}` : ""}`}
                >
                  Tổng ôn trộn đề
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
            {studyMode === "due" && studyLimits ? (
              <p className="mt-2 max-w-3xl rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
                `Hôm nay` đang áp dụng giới hạn học: mới {studyLimits.newPerDay}
                /ngày, ôn {studyLimits.reviewPerDay}/ngày. Nếu không thấy đủ số câu,
                chuyển sang tab `Tất cả` hoặc tăng giới hạn trong Tùy chọn học.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <Badge variant="outline" className="text-[11px]">
            {deckName || "Deck không tên"}
          </Badge>
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/80" />
            {isSubmitted ? "Đã nộp bài · Đang xem lại" : "Đang làm bài"}
          </span>
        </div>
      </div>

      {/* Progress */}
      {hasQuestions && (
        <Card className="border-dashed">
          <CardContent className="pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                Câu {index + 1}/{total}
              </span>
              <span className="text-muted-foreground">
                Tiến độ {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Đang tải câu hỏi...</p>
        </div>
      )}

      {!loading && !hasQuestions && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>Deck này chưa có câu hỏi trắc nghiệm.</p>
          <p>
            Hãy import từ trang{" "}
            <span className="font-mono text-primary">/import/mcq</span>.
          </p>
        </div>
      )}

      {hasQuestions && current && (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
          {/* Cột trái: Câu hỏi + đáp án */}
          <Card className="flex h-full flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Câu {index + 1} / {total}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isSubmitted
                  ? "Đang xem lại kết quả."
                  : "Chọn một đáp án, bạn có thể thay đổi trước khi nộp bài."}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-card/70 px-4 py-3 text-sm md:text-base">
                <RichContent
                  content={current.question}
                  className="leading-relaxed"
                />
              </div>

              {current.image ? (
                <div className="flex justify-center">
                  <button
                    type="button"
                    className="group"
                    onClick={() => openImage(current.image || "", "MCQ question")}
                  >
                    <img
                      src={current.image}
                      alt="MCQ question"
                      className="max-h-64 w-auto max-w-full rounded-xl border border-primary/30 object-contain shadow-lg transition group-hover:opacity-90 cursor-zoom-in"
                    />
                  </button>
                </div>
              ) : null}

              {/* Đáp án */}
              <div className="space-y-2">
                {current.choices.map((choice, i) => {
                  const state =
                    currentQuestionIndex !== null
                      ? answers[currentQuestionIndex]
                      : undefined
                  const selectedIndex = state?.selectedIndex
                  const isSelected = selectedIndex === i
                  const isCorrectChoice = choice.isCorrect

                  let choiceClasses =
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm text-left transition-all"

                  if (!isSubmitted) {
                    choiceClasses = cn(
                      choiceClasses,
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background hover:bg-muted/60",
                    )
                  } else {
                    if (isCorrectChoice) {
                      choiceClasses = cn(
                        choiceClasses,
                        "border-primary/50 bg-primary/10 text-primary",
                      )
                    } else if (isSelected && !isCorrectChoice) {
                      choiceClasses = cn(
                        choiceClasses,
                        "border-destructive bg-destructive/10 text-destructive-foreground",
                      )
                    } else {
                      choiceClasses = cn(
                        choiceClasses,
                        "border-border bg-muted/40 text-muted-foreground",
                      )
                    }
                  }

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelect(i)}
                      disabled={isSubmitted}
                      className={choiceClasses}
                    >
                      <div
                        className={cn(
                          "flex gap-3",
                          choice.image ? "items-start" : "items-center",
                        )}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <div
                          className={cn(
                            choice.image ? "space-y-2" : "flex min-h-7 items-center",
                          )}
                        >
                          <RichContent
                            content={choice.text}
                            className="leading-relaxed"
                          />
                          {choice.image ? (
                            <button
                              type="button"
                              className="group"
                              onClick={() =>
                                openImage(
                                  choice.image || "",
                                  `MCQ choice ${String.fromCharCode(65 + i)}`,
                                )
                              }
                            >
                              <img
                                src={choice.image}
                                alt="MCQ choice"
                                className="max-h-28 w-auto max-w-full rounded-lg border border-primary/30 object-contain transition group-hover:opacity-90 cursor-zoom-in"
                              />
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {isSubmitted && (
                        <span className="text-xs font-medium whitespace-nowrap">
                          {isCorrectChoice
                            ? "Đáp án đúng"
                            : isSelected
                              ? "Bạn chọn"
                              : ""}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Giải thích */}
              {isSubmitted && (
                <div className="mt-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    <span className="font-semibold text-primary">
                      Đáp án đúng:
                    </span>
                    <RichContent
                      as="span"
                      content={
                        current.choices.find(c => c.isCorrect)?.text ??
                        "Chưa đánh dấu isCorrect trong dữ liệu"
                      }
                      className="text-primary"
                    />
                  </div>
                  {current.explanation && (
                    <div className="text-muted-foreground">
                      <span className="font-semibold">Giải thích:</span>
                      <RichContent
                        content={current.explanation}
                        className="mt-1 text-sm"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {/* Điều hướng câu hỏi */}
            <CardFooter className="mt-auto flex items-center justify-between gap-3 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={isPrevDisabled}
                onClick={prevQuestion}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Câu trước
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={isSubmitted ? nextQuestion : handleMainButton}
                  disabled={isSubmitted && isNextDisabled}
                >
                  {mainButtonLabel}
                  {!isSubmitted && (
                    <ChevronRight className="ml-1 h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardFooter>
          </Card>

          {/* Cột phải: Kết quả + danh sách */}
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Kết quả & danh sách</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Khối điểm */}
              <div className="rounded-2xl border bg-muted/40 px-3 py-3">
                {isSubmitted ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-primary">
                        {score10ForDisplay.toFixed(1)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        / 10 điểm · {percentForDisplay}%
                      </span>
                    </div>
                    <p className="mt-1">
                      Đã làm{" "}
                      <span className="font-semibold">
                        {answeredForDisplay}/{totalForDisplay}
                      </span>{" "}
                      câu.
                    </p>
                    <p>
                      Đúng:{" "}
                      <span className="font-semibold text-primary">
                        {correctForDisplay}
                      </span>{" "}
                      – Sai:{" "}
                      <span className="font-semibold text-destructive">
                        {answeredForDisplay - correctForDisplay}
                      </span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1"
                      onClick={resetQuiz}
                      disabled={isSavingResult}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Làm lại từ đầu
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Chưa nộp bài</p>
                    <p className="mt-1 text-muted-foreground">
                      Bạn đã làm{" "}
                      <span className="font-semibold">
                        {answeredCount}/{total}
                      </span>{" "}
                      câu. Làm tới câu cuối rồi bấm{" "}
                      <span className="font-semibold">Nộp bài</span> để xem điểm.
                    </p>
                  </>
                )}
              </div>

              {/* Chế độ xem */}
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  Chế độ xem
                </p>
                <Tabs
                  value={reviewMode}
                  onValueChange={v => handleChangeReviewMode(v as ReviewMode)}
                >
                  <TabsList className="grid grid-cols-2">
                    <TabsTrigger value="all">Tất cả</TabsTrigger>
                    <TabsTrigger value="wrong" disabled={!isSubmitted}>
                      Chỉ câu sai
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-[11px] text-muted-foreground">
                  {reviewMode === "all"
                    ? "Xem toàn bộ câu hỏi."
                    : isSubmitted
                      ? "Chỉ hiển thị các câu bạn làm sai."
                      : "Nộp bài để xem các câu sai."}
                </p>
              </div>

              {/* Danh sách câu hỏi */}
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                  Danh sách câu hỏi
                </p>
                <div className="rounded-2xl border bg-muted/40 px-3 py-3">
                  {positionsForList.length === 0 &&
                  isSubmitted &&
                  reviewMode === "wrong" ? (
                    <p className="text-[11px] text-muted-foreground">
                      Bạn không có câu nào sai 🎉
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {positionsForList.map(pos => {
                        const questionIndex = resolvedOrder[pos]
                        const state = answers[questionIndex]
                        const isCurrent = pos === index

                        let classes =
                          "inline-flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-medium transition-all"

                        if (!isSubmitted) {
                          if (state?.selectedIndex !== null) {
                            classes = cn(
                              classes,
                              "bg-primary text-primary-foreground border-primary",
                            )
                          } else {
                            classes = cn(
                              classes,
                              "bg-background text-muted-foreground border-border",
                            )
                          }
                        } else {
                          if (state?.isCorrect === true) {
                            classes = cn(
                              classes,
                              "bg-primary text-primary-foreground border-primary/70",
                            )
                          } else if (state?.isCorrect === false) {
                            classes = cn(
                              classes,
                              "bg-destructive text-destructive-foreground border-destructive",
                            )
                          } else {
                            classes = cn(
                              classes,
                              "bg-background text-muted-foreground border-border",
                            )
                          }
                        }

                        if (isCurrent) {
                          classes = cn(
                            classes,
                            "ring-2 ring-ring ring-offset-2 ring-offset-background",
                          )
                        }

                        return (
                          <button
                            key={questionIndex}
                            type="button"
                            onClick={() => goToQuestion(pos)}
                            className={classes}
                          >
                            {pos + 1}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    {!isSubmitted ? (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-3 w-3 rounded-full bg-primary" />
                          Đã trả lời
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-3 w-3 rounded-full bg-background border border-border" />
                          Chưa làm
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-3 w-3 rounded-full bg-primary" />
                          Đúng
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-3 w-3 rounded-full bg-destructive" />
                          Sai
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Popup xác nhận nộp bài */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nộp bài trắc nghiệm?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Bạn đã làm{" "}
              <span className="font-semibold">
                {answeredCount}/{total}
              </span>{" "}
              câu.
            </p>
            {unansweredCount > 0 && (
              <p>
                Còn{" "}
                <span className="font-semibold">{unansweredCount}</span> câu
                chưa chọn đáp án. Nếu nộp bây giờ, các câu chưa làm sẽ được
                tính là sai.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" onClick={cancelSubmit}>
              Quay lại làm tiếp
            </Button>
            <Button onClick={confirmSubmit}>Nộp bài</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {lightbox?.alt || "Image"}
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

