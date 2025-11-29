"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
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
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react"

interface Choice {
  text: string
  isCorrect: boolean
}

interface Question {
  _id: string
  question: string
  choices: Choice[]
  explanation?: string
}

interface AnswerState {
  selectedIndex: number | null
  isCorrect: boolean | null
}

type ReviewMode = "all" | "wrong"

export default function MCQPage() {
  const params = useParams<{ deckId: string }>()
  const router = useRouter()
  const deckId = params.deckId

  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<AnswerState[]>([])
  const [loading, setLoading] = useState(true)
  const [deckName, setDeckName] = useState("")

  const [isSubmitted, setIsSubmitted] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [reviewMode, setReviewMode] = useState<ReviewMode>("all")

  // Lấy deck name + câu hỏi MCQ
  useEffect(() => {
    const fetchAll = async () => {
      if (!deckId) return

      try {
        setLoading(true)

        const [deckRes, questionsRes] = await Promise.all([
          fetch("/api/decks"),
          fetch(`/api/questions?deckId=${deckId}`),
        ])

        const deckList = await deckRes.json()
        const deck = deckList.find((d: any) => d._id === deckId)
        setDeckName(deck?.name ?? "")

        const data: Question[] = await questionsRes.json()
        setQuestions(data)
        setAnswers(
          data.map(() => ({
            selectedIndex: null,
            isCorrect: null,
          })),
        )
        setIndex(0)
        setIsSubmitted(false)
        setShowSubmitModal(false)
        setReviewMode("all")
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
  }, [deckId])

  const hasQuestions = questions.length > 0
  const current = hasQuestions ? questions[index] : null
  const total = questions.length

  const unansweredCount = answers.filter(a => a.selectedIndex === null).length
  const correctCount = answers.filter(a => a.isCorrect === true).length
  const answeredCount = total - unansweredCount
  const percent = total ? Math.round((correctCount / total) * 100) : 0
  const score10 = total ? (correctCount / total) * 10 : 0

  const progress = hasQuestions ? ((index + 1) / total) * 100 : 0

  // Lọc index câu theo mode xem (tất cả / chỉ câu sai sau khi nộp)
  const getFilteredIndices = () => {
    if (!isSubmitted || reviewMode === "all") {
      return questions.map((_, i) => i)
    }
    const wrongIndices: number[] = []
    answers.forEach((a, i) => {
      if (a?.isCorrect === false) wrongIndices.push(i)
    })
    return wrongIndices
  }

  const filteredIndices = getFilteredIndices()
  const currentFilteredPos = filteredIndices.indexOf(index)
  const isFirstInView =
    filteredIndices.length === 0 ? true : currentFilteredPos <= 0
  const isLastInView =
    filteredIndices.length === 0
      ? true
      : currentFilteredPos === filteredIndices.length - 1

  // Disable nút prev/next
  const isPrevDisabled =
    !hasQuestions ||
    (!isSubmitted && index === 0) ||
    (isSubmitted && isFirstInView)
  const isNextDisabled = !hasQuestions || (isSubmitted && isLastInView)

  // Danh sách index để render list câu hỏi
  const questionIndicesForList =
    !isSubmitted || reviewMode === "all"
      ? questions.map((_, i) => i)
      : filteredIndices

  const isLastQuestionBeforeSubmit =
    !isSubmitted && hasQuestions && index === total - 1

  // Chọn đáp án
  const handleSelect = (choiceIndex: number) => {
    if (!current || isSubmitted) return

    setAnswers(prev => {
      const copy = [...prev]
      const isCorrect = current.choices[choiceIndex]?.isCorrect ?? false
      copy[index] = { selectedIndex: choiceIndex, isCorrect }
      return copy
    })
  }

  const goToQuestion = (i: number) => {
    setIndex(i)
  }

  const nextQuestion = () => {
    if (!hasQuestions) return

    const filtered = getFilteredIndices()
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

    const filtered = getFilteredIndices()
    if (filtered.length === 0) return

    const pos = filtered.indexOf(index)
    if (pos === -1) {
      setIndex(filtered[0])
      return
    }

    const prevPos = Math.max(pos - 1, 0)
    setIndex(filtered[prevPos])
  }

  // Nút chính: trước khi nộp = Tiếp / Nộp bài, sau khi nộp = Câu tiếp theo
  const handleMainButton = () => {
    if (!hasQuestions) return
    if (index < total - 1) {
      setIndex(prev => Math.min(prev + 1, total - 1))
    } else {
      setShowSubmitModal(true)
    }
  }

  const confirmSubmit = () => {
    setIsSubmitted(true)
    setShowSubmitModal(false)
    setReviewMode("all")
  }

  const cancelSubmit = () => {
    setShowSubmitModal(false)
  }

  const resetQuiz = () => {
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
  }

  const handleChangeReviewMode = (mode: ReviewMode) => {
    setReviewMode(mode)
    if (mode === "wrong" && isSubmitted) {
      const firstWrongIndex = answers.findIndex(a => a?.isCorrect === false)
      if (firstWrongIndex !== -1) {
        setIndex(firstWrongIndex)
      }
    }
  }

  const mainButtonLabel = isSubmitted
    ? "Câu tiếp theo"
    : isLastQuestionBeforeSubmit
      ? "Nộp bài"
      : "Câu tiếp theo"

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col gap-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/decks")}
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
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          <Badge variant="outline" className="text-[11px]">
            {deckName || "Deck không tên"}
          </Badge>
          <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
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
                <p className="whitespace-pre-wrap leading-relaxed">
                  {current.question}
                </p>
              </div>

              {/* Đáp án */}
              <div className="space-y-2">
                {current.choices.map((choice, i) => {
                  const state = answers[index]
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
                        "border-emerald-500 bg-emerald-500/10 text-emerald-50",
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
                      <div className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold">
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="whitespace-pre-wrap">
                          {choice.text}
                        </span>
                      </div>

                      {isSubmitted && (
                        <span className="text-xs font-medium">
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
                  <p className="mb-1">
                    <span className="font-semibold text-emerald-400">
                      Đáp án đúng:{" "}
                    </span>
                    {current.choices.find(c => c.isCorrect)?.text ??
                      "Chưa đánh dấu isCorrect trong dữ liệu"}
                  </p>
                  {current.explanation && (
                    <p className="text-muted-foreground">
                      <span className="font-semibold">Giải thích: </span>
                      {current.explanation}
                    </p>
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

          {/* Cột phải: Kết quả + danh sách câu */}
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
                      <span className="text-2xl font-semibold text-emerald-400">
                        {score10.toFixed(1)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        / 10 điểm · {percent}%
                      </span>
                    </div>
                    <p className="mt-1">
                      Đã làm{" "}
                      <span className="font-semibold">
                        {answeredCount}/{total}
                      </span>{" "}
                      câu.
                    </p>
                    <p>
                      Đúng:{" "}
                      <span className="font-semibold text-emerald-400">
                        {correctCount}
                      </span>{" "}
                      – Sai:{" "}
                      <span className="font-semibold text-destructive">
                        {answeredCount - correctCount}
                      </span>
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 gap-1"
                      onClick={resetQuiz}
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
                      câu. Làm tới câu cuối rồi bấm <span className="font-semibold">Nộp bài</span> để xem điểm.
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
                  {questionIndicesForList.length === 0 &&
                  isSubmitted &&
                  reviewMode === "wrong" ? (
                    <p className="text-[11px] text-muted-foreground">
                      Bạn không có câu nào sai 🎉
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {questionIndicesForList.map(i => {
                        const state = answers[i]
                        const isCurrent = i === index

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
                              "bg-emerald-500 text-emerald-950 border-emerald-400",
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
                            key={i}
                            type="button"
                            onClick={() => goToQuestion(i)}
                            className={classes}
                          >
                            {i + 1}
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
                          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
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
    </div>
  )
}
