// app/decks/[deckId]/deck-options-client.tsx
"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { DeckOptions } from "@/lib/fsrs"

const STEP_PATTERN = /^\s*\d+\s*(m|h|d)\s*$/i

const parseSteps = (value: string) => {
  const tokens = value
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean)

  const steps: string[] = []
  const invalid: string[] = []

  tokens.forEach((token) => {
    if (!STEP_PATTERN.test(token)) {
      invalid.push(token)
      return
    }
    steps.push(token.toLowerCase())
  })

  return { steps, invalid }
}

const toNumber = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : NaN
}

const stringifySteps = (steps: string[]) => steps.join(", ")

const compareSteps = (a: string[], b: string[]) =>
  a.join("|") === b.join("|")

export default function DeckOptionsClient({
  deckId,
  initialOptions,
}: {
  deckId: string
  initialOptions: DeckOptions
}) {
  const { toast } = useToast()
  const [baseline, setBaseline] = useState(initialOptions)

  const [newPerDayInput, setNewPerDayInput] = useState(
    String(initialOptions.newPerDay),
  )
  const [reviewPerDayInput, setReviewPerDayInput] = useState(
    String(initialOptions.reviewPerDay),
  )
  const [learningStepsInput, setLearningStepsInput] = useState(
    stringifySteps(initialOptions.learningSteps),
  )
  const [relearningStepsInput, setRelearningStepsInput] = useState(
    stringifySteps(initialOptions.relearningSteps),
  )
  const [isSaving, setIsSaving] = useState(false)

  const parsedNew = toNumber(newPerDayInput)
  const parsedReview = toNumber(reviewPerDayInput)
  const { steps: learningSteps, invalid: invalidLearning } = useMemo(
    () => parseSteps(learningStepsInput),
    [learningStepsInput],
  )
  const { steps: relearningSteps, invalid: invalidRelearning } = useMemo(
    () => parseSteps(relearningStepsInput),
    [relearningStepsInput],
  )

  const isNewValid =
    Number.isFinite(parsedNew) && parsedNew >= 0 && parsedNew <= 9999
  const isReviewValid =
    Number.isFinite(parsedReview) && parsedReview >= 0 && parsedReview <= 9999

  const isDirty =
    parsedNew !== baseline.newPerDay ||
    parsedReview !== baseline.reviewPerDay ||
    !compareSteps(learningSteps, baseline.learningSteps) ||
    !compareSteps(relearningSteps, baseline.relearningSteps)

  const canSave =
    isDirty &&
    isNewValid &&
    isReviewValid &&
    invalidLearning.length === 0 &&
    invalidRelearning.length === 0 &&
    !isSaving

  const handleSave = async () => {
    if (!canSave) {
      toast({
        variant: "destructive",
        title: "Thiết lập chưa hợp lệ",
        description: "Vui lòng kiểm tra lại giới hạn và bước học.",
      })
      return
    }

    try {
      setIsSaving(true)
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: {
            newPerDay: parsedNew,
            reviewPerDay: parsedReview,
            learningSteps,
            relearningSteps,
          },
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Không thể cập nhật tùy chọn")
      }

      const nextBaseline: DeckOptions = {
        newPerDay: parsedNew,
        reviewPerDay: parsedReview,
        learningSteps,
        relearningSteps,
      }

      setBaseline(nextBaseline)
      toast({
        title: "Đã lưu tùy chọn",
        description: "Giới hạn học và bước ôn đã được cập nhật.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lưu thất bại"
      toast({
        variant: "destructive",
        title: "Không thể lưu",
        description: message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tùy chọn học</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Thiết lập giới hạn mỗi ngày và các bước học theo FSRS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Thẻ mới / ngày
            </label>
            <Input
              type="number"
              min={0}
              max={9999}
              value={newPerDayInput}
              onChange={(event) => setNewPerDayInput(event.target.value)}
            />
            {!isNewValid ? (
              <p className="text-[11px] text-destructive">
                Nhập số từ 0 đến 9999.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Giới hạn số thẻ mới được học trong ngày.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ôn tập / ngày
            </label>
            <Input
              type="number"
              min={0}
              max={9999}
              value={reviewPerDayInput}
              onChange={(event) => setReviewPerDayInput(event.target.value)}
            />
            {!isReviewValid ? (
              <p className="text-[11px] text-destructive">
                Nhập số từ 0 đến 9999.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Giới hạn số thẻ ôn (review) trong ngày.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bước học
          </label>
          <Input
            value={learningStepsInput}
            placeholder="Ví dụ: 1m, 10m, 1d"
            onChange={(event) => setLearningStepsInput(event.target.value)}
          />
          {invalidLearning.length > 0 ? (
            <p className="text-[11px] text-destructive">
              Step không hợp lệ: {invalidLearning.join(", ")}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Bước học ban đầu. Định dạng: số + m/h/d (vd: 10m, 1h, 1d).
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Bước học lại
          </label>
          <Input
            value={relearningStepsInput}
            placeholder="Ví dụ: 10m"
            onChange={(event) => setRelearningStepsInput(event.target.value)}
          />
          {invalidRelearning.length > 0 ? (
            <p className="text-[11px] text-destructive">
              Step không hợp lệ: {invalidRelearning.join(", ")}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Dùng khi bạn trả lời sai (lapse) để học lại nhanh.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            {isSaving ? "Đang lưu..." : "Lưu tùy chọn"}
          </Button>
          {isDirty && (
            <span className="text-[11px] text-muted-foreground">
              Có thay đổi chưa lưu.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
