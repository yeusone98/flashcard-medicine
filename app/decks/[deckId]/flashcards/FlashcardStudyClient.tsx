// app/decks/[deckId]/flashcards/FlashcardStudyClient.tsx

"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Settings2,
    Check,
    RefreshCw,
} from "lucide-react"

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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type FlashcardStudyClientProps = {
    deckId: string
}

type Flashcard = {
    _id: string
    front: string
    back: string
    level?: number
}

type FilterMode = "all" | "not-learned" | "learned"
type AutoSpeed = "off" | "slow" | "fast"

export default function FlashcardStudyClient({
    deckId,
}: FlashcardStudyClientProps) {
    const router = useRouter()

    const [cards, setCards] = useState<Flashcard[]>([])
    const [index, setIndex] = useState(0)
    const [showBack, setShowBack] = useState(false)
    const [loading, setLoading] = useState(true)

    const [learnedMap, setLearnedMap] = useState<Record<string, boolean>>({})
    const [filterMode, setFilterMode] = useState<FilterMode>("all")
    const [autoSpeed, setAutoSpeed] = useState<AutoSpeed>("off")
    const [settingsOpen, setSettingsOpen] = useState(false)

    // Load flashcards từ API
    useEffect(() => {
        async function fetchCards() {
            try {
                setLoading(true)
                const res = await fetch(`/api/flashcards?deckId=${deckId}`)
                const data = await res.json()
                const loaded: Flashcard[] = data.flashcards ?? data
                setCards(loaded)
                setIndex(0)
                setShowBack(false)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchCards()
    }, [deckId])

    const visibleCards = useMemo(() => {
        if (filterMode === "all") return cards
        return cards.filter((c) => {
            const learned = learnedMap[c._id] ?? false
            return filterMode === "learned" ? learned : !learned
        })
    }, [cards, filterMode, learnedMap])

    const total = visibleCards.length

    // Giữ index hợp lệ khi thay filter
    useEffect(() => {
        if (total === 0) {
            setIndex(0)
            return
        }
        if (index >= total) {
            setIndex(0)
            setShowBack(false)
        }
    }, [total, index])

    const current = total ? visibleCards[index] : null
    const progressPercent = total > 0 ? ((index + 1) / total) * 100 : 0
    const currentLearned =
        current && typeof learnedMap[current._id] === "boolean"
            ? learnedMap[current._id]
            : false

    function goPrev() {
        if (!total) return
        setShowBack(false)
        setIndex((prev) => (prev <= 0 ? total - 1 : prev - 1))
    }

    function goNext() {
        if (!total) return
        setShowBack(false)
        setIndex((prev) => (prev >= total - 1 ? 0 : prev + 1))
    }

    function setLearnedStatus(status: boolean) {
        if (!current) return
        setLearnedMap((prev) => ({
            ...prev,
            [current._id]: status,
        }))
    }


    // Auto flip/play
    useEffect(() => {
        if (autoSpeed === "off" || !current || !total) return

        const delay = autoSpeed === "slow" ? 2500 : 1300

        const id = setTimeout(() => {
            setShowBack((prev) => {
                // Lần 1: lật sang mặt sau
                if (!prev) return true

                // Lần 2: chuyển thẻ và quay về mặt trước
                setIndex((old) => (old >= total - 1 ? 0 : old + 1))
                return false
            })
        }, delay)

        return () => clearTimeout(id)
    }, [autoSpeed, current?._id, total, showBack])

    // Loading / không có thẻ
    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-sm text-muted-foreground">
                    Đang tải flashcard...
                </div>
            </div>
        )
    }

    if (!current) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
                <div className="text-base text-muted-foreground">
                    Bộ thẻ hiện tại không có thẻ nào phù hợp với bộ lọc.
                </div>
                <Button variant="outline" onClick={() => setFilterMode("all")}>
                    Hiển thị tất cả thẻ
                </Button>
            </div>
        )
    }

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
                            Học Flashcard
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            Lật thẻ để xem đáp án, đánh dấu Đã thuộc / Cần học lại.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Badge variant={currentLearned ? "default" : "outline"}>
                        {currentLearned ? "Đã thuộc" : "Cần học lại"}
                    </Badge>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSettingsOpen(true)}
                    >
                        <Settings2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Progress */}
            <Card className="border-dashed">
                <CardContent className="pt-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-muted-foreground">
                            Thẻ {index + 1}/{total}
                        </span>
                        <span className="text-muted-foreground">
                            {progressPercent.toFixed(0)}%
                        </span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                </CardContent>
            </Card>

            {/* Layout: card + sidebar */}
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                {/* Card */}
                {/* Card */}
                <div className="flex flex-col gap-4">
                    {/* FLASHCARD – hiệu ứng lật kiểu Quizlet */}
                    <div className="relative h-[340px] md:h-[380px] [perspective:1600px]">
                        <motion.button
                            type="button"
                            className="h-full w-full border-none bg-transparent p-0 outline-none"
                            onClick={() => setShowBack((prev) => !prev)}
                            whileTap={{ scale: 0.97 }}
                        >
                            <motion.div
                                className="relative h-full w-full rounded-3xl shadow-2xl shadow-black/40"
                                style={{ transformStyle: "preserve-3d" }}
                                animate={{ rotateY: showBack ? 180 : 0 }}
                                transition={{
                                    type: "tween",
                                    duration: 0.6,      // tăng lên nữa nếu muốn chậm hơn (0.7–0.8)
                                    ease: "easeInOut",
                                }}
                            >
                                {/* FRONT */}
                                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 px-6 py-5 [backface-visibility:hidden]">
                                    <div className="flex h-full flex-col justify-between">
                                        <div className="flex items-center justify-between text-xs text-slate-400">
                                            <span>Mặt trước · câu hỏi</span>
                                            <span className="flex items-center gap-1">
                                                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                                                Nhấn vào thẻ để lật
                                            </span>
                                        </div>

                                        <div className="flex flex-1 items-center justify-center">
                                            <p className="whitespace-pre-wrap text-center text-lg font-semibold leading-relaxed text-slate-50 md:text-2xl">
                                                {current.front}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>Đang học</span>
                                            <span>Deck: #{deckId}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* BACK */}
                                <div className="absolute inset-0 rounded-3xl bg-slate-950 border border-emerald-600 px-6 py-5 [transform:rotateY(180deg)] [backface-visibility:hidden]">
                                    <div className="flex h-full flex-col justify-between">
                                        <div className="flex items-center justify-between text-xs text-emerald-300">
                                            <span>Mặt sau · đáp án</span>
                                            <span className="flex items-center gap-1">
                                                <Check className="h-3 w-3" />
                                                Kiểm tra rồi đánh dấu trạng thái
                                            </span>
                                        </div>

                                        <div className="flex flex-1 items-center justify-center">
                                            <p className="whitespace-pre-wrap text-center text-base font-medium leading-relaxed text-emerald-100 md:text-xl">
                                                {current.back}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                                            <span>Nhấn lại để quay về mặt trước</span>
                                            {typeof current.level === "number" && (
                                                <Badge
                                                    variant="outline"
                                                    className="border-emerald-500/40 text-emerald-300"
                                                >
                                                    Level {current.level}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.button>
                    </div>

                    {/* Main actions */}
                    {/* Main actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={goPrev}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={goNext}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Đặt về ĐÃ THUỘC */}
                            <Button
                                size="sm"
                                variant={currentLearned ? "default" : "outline"}
                                className="h-8 px-3 text-xs"
                                onClick={() => setLearnedStatus(true)}
                            >
                                <Check className="mr-1 h-4 w-4" />
                                Đã thuộc
                            </Button>

                            {/* Đặt về CẦN HỌC LẠI */}
                            <Button
                                size="sm"
                                variant={!currentLearned ? "default" : "outline"}
                                className="h-8 px-3 text-xs"
                                onClick={() => setLearnedStatus(false)}
                            >
                                <RefreshCw className="mr-1 h-4 w-4" />
                                Cần học lại
                            </Button>

                            {/* Auto play */}
                            <Button
                                size="icon"
                                variant={autoSpeed === "off" ? "outline" : "default"}
                                onClick={() =>
                                    setAutoSpeed((prev) => {
                                        if (prev === "off") return "slow"
                                        if (prev === "slow") return "fast"
                                        return "off"
                                    })
                                }
                            >
                                {autoSpeed === "off" ? (
                                    <Play className="h-4 w-4" />
                                ) : (
                                    <Pause className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                    {/* Sidebar: filter + stats */}
                    <Card className="h-full">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Tùy chọn học</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs">
                            <Tabs
                                value={filterMode}
                                onValueChange={(v) => setFilterMode(v as FilterMode)}
                            >
                                <TabsList className="grid grid-cols-3">
                                    <TabsTrigger value="all">Tất cả</TabsTrigger>
                                    <TabsTrigger value="not-learned">Chưa thuộc</TabsTrigger>
                                    <TabsTrigger value="learned">Đã thuộc</TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="space-y-1">
                                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                                    Tự động
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant={autoSpeed === "slow" ? "default" : "outline"}
                                        className="h-8 px-2 text-xs"
                                        onClick={() => setAutoSpeed("slow")}
                                    >
                                        Chậm
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={autoSpeed === "fast" ? "default" : "outline"}
                                        className="h-8 px-2 text-xs"
                                        onClick={() => setAutoSpeed("fast")}
                                    >
                                        Nhanh
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={autoSpeed === "off" ? "default" : "outline"}
                                        className="h-8 px-2 text-xs"
                                        onClick={() => setAutoSpeed("off")}
                                    >
                                        Tắt
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-[11px] font-medium uppercase text-muted-foreground">
                                    Thống kê
                                </p>
                                <ul className="space-y-1.5 text-[11px] text-muted-foreground">
                                    <li>
                                        Tổng thẻ:{" "}
                                        <span className="font-semibold text-foreground">
                                            {cards.length}
                                        </span>
                                    </li>
                                    <li>
                                        Đã thuộc:{" "}
                                        <span className="font-semibold text-emerald-600">
                                            {Object.values(learnedMap).filter(Boolean).length}
                                        </span>
                                    </li>
                                    <li>
                                        Cần học lại:{" "}
                                        <span className="font-semibold text-amber-600">
                                            {cards.length -
                                                Object.values(learnedMap).filter(Boolean).length}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Settings dialog – để dành future custom */}
                <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Cài đặt học flashcard</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 text-sm text-muted-foreground">
                            <p>
                                Bạn có thể thêm các tuỳ chọn nâng cao ở đây: thời gian auto,
                                kiểu hiển thị, ẩn/hiện mặt sau, v.v…
                            </p>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                                Đóng
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            )
}
