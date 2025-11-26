"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileQuestion, ChevronLeft, ChevronRight, Check, X, ListOrdered } from "lucide-react"

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type PageProps = { params: { deckId: string } }

type Choice = { text: string; isCorrect: boolean }
type Question = {
  _id: string
  question: string
  choices: Choice[]
  explanation?: string
}

type AnswerState = {
  selectedIndex: number | null
  isCorrect: boolean | null
}

type ReviewMode = "all" | "wrong"

export default function McqPage({ params }: PageProps) {
  const { deckId } = params
  const router = useRouter()

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<AnswerState[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [reviewMode, setReviewMode] = useState<ReviewMode>("all")

  // TODO: chỉnh lại URL API nếu khác
  useEffect(() => {
    async function fetchQuestions() {
      try {
        setLoading(true)
        const res = await fetch(`/api/questions?deckId=${deckId}`)
        const data = await res.json()
        const qs: Question[] = data.questions ?? data
        setQuestions(qs)
        setAnswers(qs.map(() => ({ selectedIndex: null, isCorrect: null })))
        setIndex(0)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchQuestions()
  }, [deckId])

  const filteredIndices = useMemo(() => {
    if (!isSubmitted || reviewMode === "all") {
      return questions.map((_, i) => i)
    }
    // chỉ câu sai
    return questions
      .map((_, i) => i)
      .filter((i) => answers[i]?.isCorrect === false || answers[i]?.selectedIndex === null)
  }, [questions, answers, isSubmitted, reviewMode])

  // đảm bảo index hợp lệ trong filteredIndices
  useEffect(() => {
    if (!filteredIndices.length) return
    const pos = filteredIndices.indexOf(index)
    if (pos === -1) {
      setIndex(filteredIndices[0])
    }
  }, [filteredIndices, index])

  const current = questions[index]
  const currentAnswer = answers[index]

  const unansweredCount = answers.filter((a) => a.selectedIndex === null).length
  const answeredCount = questions.length - unansweredCount
  const correctCount = answers.filter((a) => a.isCorrect === true).length
  const wrongCount = answers.filter((a) => a.isCorrect === false).length

  const percent = questions.length ? (correctCount / questions.length) * 100 : 0
  const score10 = questions.length ? (correctCount / questions.length) * 10 : 0

  const progressPercent = questions.length ? ((index + 1) / questions.length) * 100 : 0

  function handleSelectChoice(choiceIndex: number) {
    if (isSubmitted) return
    if (!current) return

    const choice = current.choices[choiceIndex]
    setAnswers((prev) => {
      const draft = [...prev]
      draft[index] = {
        selectedIndex: choiceIndex,
        isCorrect: choice.isCorrect,
      }
      return draft
    })
  }

  function goNext() {
    if (!filteredIndices.length) return
    const pos = filteredIndices.indexOf(index)
    if (pos === -1 || pos === filteredIndices.length - 1) return
    setIndex(filteredIndices[pos + 1])
  }

  function goPrev() {
    if (!filteredIndices.length) return
    const pos = filteredIndices.indexOf(index)
    if (pos <= 0) return
    setIndex(filteredIndices[pos - 1])
  }

  const isLastVisible = useMemo(() => {
    if (!filteredIndices.length) return false
    const pos = filteredIndices.indexOf(index)
    return pos === filteredIndices.length - 1
  }, [filteredIndices, index])

  function handleMainButton() {
    if (!isLastVisible || !questions.length) {
      goNext()
      return
    }
    // đang ở câu cuối → mở popup nộp
    setSubmitOpen(true)
  }

  function confirmSubmit() {
    setIsSubmitted(true)
    setSubmitOpen(false)
    setReviewMode("all")
  }

  function resetQuiz() {
    setAnswers(questions.map(() => ({ selectedIndex: null, isCorrect: null })))
    setIsSubmitted(false)
    setIndex(0)
    setReviewMode("all")
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Đang tải câu hỏi trắc nghiệm...</div>
      </div>
    )
  }

  if (!questions.length) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Hiện chưa có câu hỏi nào cho bộ thẻ này.</p>
        <Button variant="outline" onClick={() => router.push(`/decks/${deckId}`)}>
          Quay lại Deck
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col gap-5 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/decks/${deckId}`)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <FileQuestion className="h-4 w-4 text-primary" />
              Trắc nghiệm · Deck #{deckId}
            </h1>
            <p className="text-xs text-muted-foreground">
              Chọn đáp án, tới câu cuối nút sẽ thành Nộp bài. Nộp xong mới hiện điểm & đáp án.
            </p>
          </div>
        </div>

        {isSubmitted && (
          <div className="flex flex-col items-end text-right gap-1">
            <div className="text-xs text-muted-foreground">Kết quả</div>
            <div className="text-sm font-semibold">
              {score10.toFixed(1)}/10 điểm · {percent.toFixed(0)}%
            </div>
            <div className="text-[11px] text-muted-foreground">
              Đúng{" "}
              <span className="font-semibold text-emerald-600">{correctCount}</span> · Sai{" "}
              <span className="font-semibold text-rose-600">{wrongCount}</span> · Đã làm{" "}
              <span className="font-semibold">{answeredCount}</span>/{questions.length}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <Card className="border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-muted-foreground">
              Câu {index + 1}/{questions.length}
            </span>
            <span className="text-muted-foreground">{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]">
        {/* Question + choices */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Câu hỏi</span>
              <Badge variant="outline" className="text-[11px]">
                {index + 1}/{questions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 pt-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {current.question}
            </p>

            <div className="space-y-2">
              {current.choices.map((choice, i) => {
                const selected = currentAnswer?.selectedIndex === i
                const isCorrectChoice = choice.isCorrect
                const showAsCorrect = isSubmitted && isCorrectChoice
                const showAsWrongSelected = isSubmitted && selected && !isCorrectChoice

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectChoice(i)}
                    className={cn(
                      "w-full rounded-xl border text-left text-sm px-3 py-2.5 transition-all",
                      "flex items-center justify-between gap-2",
                      "hover:bg-muted",
                      selected && !isSubmitted && "border-primary/60 bg-primary/5",
                      showAsCorrect &&
                        "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
                      showAsWrongSelected &&
                        "border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-200"
                    )}
                  >
                    <span className="flex-1">{choice.text}</span>
                    <span className="flex items-center gap-1 text-xs">
                      {showAsCorrect && <Check className="h-3.5 w-3.5" />}
                      {showAsWrongSelected && <X className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                )
              })}
            </div>

            {isSubmitted && (
              <div className="mt-4 space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Đáp án đúng</span>
                  <Badge variant="outline" className="text-[11px]">
                    {current.choices.findIndex((c) => c.isCorrect) !== -1
                      ? `Lựa chọn ${
                          current.choices.findIndex((c) => c.isCorrect) + 1
                        }`
                      : "Không có đáp án đúng đánh dấu"}
                  </Badge>
                </div>
                {current.explanation && (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {current.explanation}
                  </p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="mt-auto flex items-center justify-between gap-3 pt-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goPrev} disabled={filteredIndices.indexOf(index) <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isLastVisible ? "default" : "outline"}
                size="sm"
                onClick={handleMainButton}
              >
                {isLastVisible ? "Nộp bài" : "Tiếp theo"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {isSubmitted && (
                <Button variant="outline" size="sm" onClick={resetQuiz}>
                  Làm lại từ đầu
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        {/* Sidebar: list câu hỏi + bộ lọc */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ListOrdered className="h-4 w-4 text-primary" />
              Danh sách câu hỏi
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="flex-1 pt-3">
            <div className="mb-3 flex flex-col gap-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Đã làm:{" "}
                  <span className="font-semibold text-foreground">
                    {answeredCount}/{questions.length}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Chưa làm:{" "}
                  <span className="font-semibold text-amber-600">
                    {unansweredCount}
                  </span>
                </span>
              </div>

              <Tabs
                value={reviewMode}
                onValueChange={(v) => setReviewMode(v as ReviewMode)}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="all">Tất cả</TabsTrigger>
                  <TabsTrigger value="wrong" disabled={!isSubmitted || wrongCount === 0}>
                    Chỉ câu sai ({wrongCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="h-[320px] pr-2">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const a = answers[i]
                  const isCurrent = i === index

                  let bgClass = ""
                  if (!isSubmitted) {
                    if (a?.selectedIndex !== null) {
                      bgClass = "bg-blue-500/10 text-blue-700 dark:text-blue-200 border-blue-500/60"
                    } else {
                      bgClass = "bg-muted text-muted-foreground"
                    }
                  } else {
                    if (a?.isCorrect === true) {
                      bgClass = "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 border-emerald-500/60"
                    } else if (a?.selectedIndex !== null) {
                      bgClass = "bg-rose-500/10 text-rose-700 dark:text-rose-200 border-rose-500/60"
                    } else {
                      bgClass = "bg-muted text-muted-foreground"
                    }
                  }

                  // Ẩn những câu không thuộc filteredIndices sau khi nộp + chọn chế độ "chỉ sai"
                  if (isSubmitted && reviewMode === "wrong" && !filteredIndices.includes(i)) {
                    return null
                  }

                  return (
                    <button
                      key={q._id}
                      type="button"
                      onClick={() => setIndex(i)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-full border text-xs font-medium transition-all",
                        "hover:brightness-110",
                        bgClass,
                        isCurrent && "ring-2 ring-offset-1 ring-primary"
                      )}
                    >
                      {i + 1}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Submit dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận nộp bài</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            {unansweredCount > 0 ? (
              <p>
                Bạn còn{" "}
                <span className="font-semibold text-amber-600">{unansweredCount}</span>/
                {questions.length} câu chưa làm. Bạn có chắc chắn muốn nộp bài không?
              </p>
            ) : (
              <p>
                Bạn đã trả lời đủ{" "}
                <span className="font-semibold">{questions.length}</span>/
                {questions.length} câu. Nộp bài để xem điểm và đáp án chi tiết.
              </p>
            )}
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>
              Kiểm tra lại
            </Button>
            <Button onClick={confirmSubmit}>Nộp bài</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
