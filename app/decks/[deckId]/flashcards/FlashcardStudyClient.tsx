"use client"

import { useCallback, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"

type ReviewRating = "again" | "hard" | "good" | "easy"

const RATING_TO_GRADE: Record<ReviewRating, 0 | 1 | 2 | 3 | 4 | 5> = {
    again: 1,
    hard: 3,
    good: 4,
    easy: 5,
}

export interface FlashcardStudyItem {
    _id: string
    front: string
    back: string
}

interface FlashcardStudyClientProps {
    deckId: string
    deckName: string
    cards: FlashcardStudyItem[]
}

export default function FlashcardStudyClient({
    deckId,
    deckName,
    cards,
}: FlashcardStudyClientProps) {
    const { toast } = useToast()
    const [index, setIndex] = useState(0)
    const [showBack, setShowBack] = useState(false)
    const [isReviewing, setIsReviewing] = useState(false)

    const total = cards.length

    const current = useMemo(() => {
        if (total === 0) return null
        return cards[index]
    }, [cards, index, total])

    const progressValue = useMemo(() => {
        if (total === 0) return 0
        return ((index + 1) / total) * 100
    }, [index, total])

    const handleFlip = () => {
        if (!current) return
        setShowBack((prev) => !prev)
    }

    const goNext = useCallback(() => {
        if (total === 0) return
        setShowBack(false)
        setIndex((prev) => {
            if (prev + 1 >= total) return prev
            return prev + 1
        })
    }, [total])

    const goPrev = () => {
        if (total === 0) return
        setShowBack(false)
        setIndex((prev) => (prev === 0 ? 0 : prev - 1))
    }

    const resetStudy = () => {
        setIndex(0)
        setShowBack(false)
    }

    const handleRating = async (rating: ReviewRating) => {
        if (!current) return
        const grade = RATING_TO_GRADE[rating]

        try {
            setIsReviewing(true)

            const res = await fetch(`/api/flashcards/${current._id}/review`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grade }),
            })

            const data = await res.json().catch(() => null)

            if (!res.ok) {
                throw new Error(data?.error || "Không cập nhật được lịch ôn")
            }

            toast({
                title:
                    rating === "again"
                        ? "Đánh dấu: Again"
                        : rating === "hard"
                            ? "Đánh dấu: Hard"
                            : rating === "good"
                                ? "Đánh dấu: Good"
                                : "Đánh dấu: Easy",
                description: "Đã cập nhật lịch ôn cho thẻ này.",
            })

            goNext()
        } catch (err: any) {
            console.error(err)
            toast({
                variant: "destructive",
                title: "Lỗi khi chấm thẻ",
                description: err?.message || "Vui lòng thử lại.",
            })
        } finally {
            setIsReviewing(false)
        }
    }

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

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-base font-semibold md:text-lg">
                        Học flashcard – {deckName}
                    </h1>
                    <p className="text-xs text-muted-foreground md:text-sm">
                        Thẻ {index + 1} / {total}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goPrev}
                            disabled={index === 0}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={goNext}
                            disabled={index === total - 1}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={resetStudy}
                        title="Học lại từ đầu"
                    >
                        <RefreshCcw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="space-y-1">
                <Progress value={progressValue} />
                <p className="text-xs text-muted-foreground">
                    Tiến độ: {index + 1}/{total}
                </p>
            </div>

            <div className="mt-3 flex justify-center">
                <div className="h-[360px] w-full max-w-2xl [perspective:1200px]">
                    <AnimatePresence mode="wait" initial={false}>
                        {current && (
                            <motion.div
                                key={current._id + (showBack ? "-back" : "-front")}
                                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -24, scale: 0.97 }}
                                transition={{ duration: 0.22, ease: "easeOut" }}
                                className="relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-2xl shadow-slate-950/70 dark:border-slate-700"
                                onClick={handleFlip}
                            >
                                <div className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(52,211,153,0.15),_transparent_55%)]" />

                                <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-6 py-8 text-center text-slate-50">
                                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                                        {showBack ? "MẶT SAU" : "MẶT TRƯỚC"}
                                    </p>
                                    <div className="max-h-[220px] overflow-y-auto whitespace-pre-wrap text-base leading-relaxed md:text-lg">
                                        {showBack ? current.back : current.front}
                                    </div>
                                    <p className="mt-4 text-[11px] text-slate-400">
                                        Nhấn vào thẻ để lật
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="mt-4 space-y-1">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={isReviewing || !current}
                        onClick={() => handleRating("again")}
                    >
                        Again
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isReviewing || !current}
                        onClick={() => handleRating("hard")}
                    >
                        Hard
                    </Button>
                    <Button
                        variant="default"
                        size="sm"
                        disabled={isReviewing || !current}
                        onClick={() => handleRating("good")}
                    >
                        Good
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        disabled={isReviewing || !current}
                        onClick={() => handleRating("easy")}
                    >
                        Easy
                    </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                    Again: không nhớ/nhớ sai • Hard: nhớ chật vật • Good: nhớ ổn • Easy:
                    quá dễ, lần sau giãn cách xa hơn
                </p>
            </div>
        </div>
    )
}
