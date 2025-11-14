// app/decks/[deckId]/flashcards/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface Flashcard {
    _id: string
    front: string
    back: string
}

type FilterMode = 'all' | 'not-learned' | 'learned'
type AutoSpeed = 'slow' | 'fast'

export default function FlashcardStudyPage() {
    const params = useParams<{ deckId: string }>()
    const router = useRouter()
    const deckId = params.deckId

    const [cards, setCards] = useState<Flashcard[]>([])
    const [index, setIndex] = useState(0)
    const [showBack, setShowBack] = useState(false)
    const [loading, setLoading] = useState(true)

    const [learnedMap, setLearnedMap] = useState<Record<string, boolean>>({})
    const [filterMode, setFilterMode] = useState<FilterMode>('all')

    const [showSettings, setShowSettings] = useState(false)
    const [autoRunning, setAutoRunning] = useState(false)
    const [autoSpeed, setAutoSpeed] = useState<AutoSpeed>('slow')

    // --------- LOAD DATA ----------
    useEffect(() => {
        const fetchCards = async () => {
            setLoading(true)
            const res = await fetch(`/api/flashcards?deckId=${deckId}`)
            const data: Flashcard[] = await res.json()
            setCards(data)
            setIndex(0)
            setShowBack(false)

            const map: Record<string, boolean> = {}
            data.forEach(c => {
                map[c._id] = false
            })
            setLearnedMap(map)
            setFilterMode('all')
            setAutoRunning(false)
            setLoading(false)
        }

        if (deckId) fetchCards()
    }, [deckId])

    const visibleCards = useMemo(
        () =>
            cards.filter(card => {
                const learned = learnedMap[card._id] === true
                if (filterMode === 'all') return true
                if (filterMode === 'learned') return learned
                if (filterMode === 'not-learned') return !learned
                return true
            }),
        [cards, learnedMap, filterMode]
    )

    useEffect(() => {
        if (visibleCards.length === 0) {
            setIndex(0)
            setShowBack(false)
            return
        }
        if (index >= visibleCards.length) {
            setIndex(0)
            setShowBack(false)
        }
    }, [visibleCards.length, index])

    // ---------- AUTO RUN ----------
    useEffect(() => {
        if (!autoRunning || visibleCards.length === 0) return

        const delay = autoSpeed === 'fast' ? 1200 : 2500
        const id = setInterval(() => {
            setShowBack(prev => {
                if (!visibleCards.length) return false
                if (!prev) {
                    // lần 1: lật mặt sau
                    return true
                } else {
                    // lần 2: sang thẻ tiếp theo, quay về mặt trước
                    setIndex(prevIndex =>
                        visibleCards.length === 0 ? 0 : (prevIndex + 1) % visibleCards.length
                    )
                    return false
                }
            })
        }, delay)

        return () => clearInterval(id)
    }, [autoRunning, autoSpeed, visibleCards.length])

    const hasCards = visibleCards.length > 0
    const current = hasCards ? visibleCards[index] : null

    const progress = hasCards ? ((index + 1) / visibleCards.length) * 100 : 0
    const learnedCount = cards.filter(c => learnedMap[c._id]).length

    const next = () => {
        if (!visibleCards.length) return
        setShowBack(false)
        setIndex(prev => (prev + 1) % visibleCards.length)
    }

    const prev = () => {
        if (!visibleCards.length) return
        setShowBack(false)
        setIndex(prev => (prev - 1 + visibleCards.length) % visibleCards.length)
    }

    const shuffleCards = () => {
        setShowBack(false)
        setIndex(0)
        setCards(prev => {
            const arr = [...prev]
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                    ;[arr[i], arr[j]] = [arr[j], arr[i]]
            }
            return arr
        })
    }

    const currentLearned = current ? learnedMap[current._id] === true : false

    const toggleLearned = () => {
        if (!current) return
        setLearnedMap(prev => ({
            ...prev,
            [current._id]: !currentLearned,
        }))
    }

    const handleChangeFilter = (mode: FilterMode) => {
        setFilterMode(mode)
        setIndex(0)
        setShowBack(false)
    }

    // ================== UI ==================
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
            <div className="w-full max-w-5xl px-4 py-10 space-y-6">
                {/* Top bar */}
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={() => router.push('/decks')}
                        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-100"
                    >
                        <span>←</span>
                        <span>Quay lại danh sách deck</span>
                    </button>

                    <div className="flex items-center gap-3">
                        {hasCards && (
                            <div className="text-xs text-slate-400">
                                Thẻ{' '}
                                <span className="font-semibold text-slate-100">
                                    {index + 1}/{visibleCards.length}
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowSettings(s => !s)}
                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
                        >
                            <span>⚙️</span>
                            <span>Cài đặt</span>
                        </button>
                    </div>
                </div>

                {/* Progress */}
                {hasCards && (
                    <div className="w-full">
                        <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                            <span>Tiến độ</span>
                            <span>
                                {index + 1}/{visibleCards.length}
                            </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-violet-400 transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Settings */}
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="rounded-2xl border border-slate-800 bg-slate-950/90 px-5 py-4 text-xs shadow-lg shadow-slate-950/60"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <p className="font-semibold text-slate-200">Chế độ xem</p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleChangeFilter('all')}
                                        className={`px-3 py-1.5 rounded-full border ${filterMode === 'all'
                                            ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                                            : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                                            }`}
                                    >
                                        Xem tất cả
                                    </button>
                                    <button
                                        onClick={() => handleChangeFilter('not-learned')}
                                        className={`px-3 py-1.5 rounded-full border ${filterMode === 'not-learned'
                                            ? 'bg-sky-500/15 border-sky-400 text-sky-100'
                                            : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                                            }`}
                                    >
                                        Chỉ chưa thuộc
                                    </button>
                                    <button
                                        onClick={() => handleChangeFilter('learned')}
                                        className={`px-3 py-1.5 rounded-full border ${filterMode === 'learned'
                                            ? 'bg-violet-500/15 border-violet-400 text-violet-100'
                                            : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                                            }`}
                                    >
                                        Chỉ đã thuộc
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <p className="font-semibold text-slate-200">Thứ tự</p>
                                    <button
                                        type="button"
                                        onClick={shuffleCards}
                                        className="px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100 text-[11px] inline-flex items-center gap-1"
                                    >
                                        <span>🔀</span>
                                        <span>Xáo trộn flashcard</span>
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <p className="font-semibold text-slate-200">Tự chạy</p>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAutoSpeed('slow')
                                                setAutoRunning(true)
                                            }}
                                            className={`px-3 py-1.5 rounded-full border text-[11px] ${autoRunning && autoSpeed === 'slow'
                                                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                                                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                                                }`}
                                        >
                                            ⏯ Chậm
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAutoSpeed('fast')
                                                setAutoRunning(true)
                                            }}
                                            className={`px-3 py-1.5 rounded-full border text-[11px] ${autoRunning && autoSpeed === 'fast'
                                                ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                                                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                                                }`}
                                        >
                                            ⏯ Nhanh
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAutoRunning(false)}
                                            className={`px-3 py-1.5 rounded-full border text-[11px] ${!autoRunning
                                                ? 'bg-rose-500/15 border-rose-400 text-rose-100'
                                                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                                                }`}
                                        >
                                            ⏹ Tạm dừng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {cards.length > 0 && (
                            <p className="mt-3 text-[11px] text-slate-500">
                                Đã thuộc{' '}
                                <span className="text-emerald-300 font-semibold">
                                    {learnedCount}/{cards.length}
                                </span>{' '}
                                thẻ trong deck này.
                            </p>
                        )}
                    </motion.div>
                )}

                {!loading && !hasCards && (
                    <p className="text-slate-400">
                        Deck này chưa có flashcard. Hãy import từ /import/mcq, /import/cloze
                        hoặc /import/qa.
                    </p>
                )}

                {hasCards && current && (
                    <>
                        {/* CARD + FLIP: xoay từng mặt, không xoay parent → chữ không bao giờ ngược */}
                        <div className="flex justify-center mt-4">
                            <div className="w-full max-w-2xl h-[360px] md:h-[380px] [perspective:1200px]">
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={current._id}
                                        initial={{ opacity: 0, y: 24, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -24, scale: 0.97 }}
                                        transition={{ duration: 0.23, ease: 'easeOut' }}
                                        className="relative w-full h-full rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-2xl shadow-slate-950/70 overflow-hidden"
                                    >
                                        {/* FRONT FACE */}
                                        <motion.div
                                            onClick={() => setShowBack(s => !s)}
                                            className="absolute inset-0 px-8 py-7 md:px-10 md:py-9 cursor-pointer flex flex-col justify-center items-center text-center"
                                            style={{
                                                backfaceVisibility: 'hidden',
                                                transformStyle: 'preserve-3d',
                                            }}
                                            initial={false}
                                            animate={{ rotateY: showBack ? 180 : 0 }}
                                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                                        >
                                            <div className="flex justify-between w-full mb-4 text-[11px] text-slate-500">
                                                <span>Mặt trước</span>
                                                <span className="italic">Bấm vào thẻ để lật</span>
                                            </div>
                                            <p className="text-xl md:text-2xl whitespace-pre-wrap leading-relaxed">
                                                {current.front}
                                            </p>
                                        </motion.div>

                                        {/* BACK FACE */}
                                        <motion.div
                                            onClick={() => setShowBack(s => !s)}
                                            className="absolute inset-0 px-8 py-7 md:px-10 md:py-9 cursor-pointer flex flex-col justify-center items-center text-center"
                                            style={{
                                                backfaceVisibility: 'hidden',
                                                transformStyle: 'preserve-3d',
                                            }}
                                            initial={false}
                                            animate={{ rotateY: showBack ? 0 : -180 }}
                                            transition={{ duration: 0.4, ease: 'easeInOut' }}
                                        >
                                            <div className="flex justify-between w-full mb-4 text-[11px] text-slate-500">
                                                <span>Mặt sau</span>
                                                <span className="italic">Bấm vào thẻ để lật lại</span>
                                            </div>
                                            <p className="text-xl md:text-2xl whitespace-pre-wrap leading-relaxed">
                                                {current.back}
                                            </p>
                                        </motion.div>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Counter */}
                        <div className="flex justify-center mt-3">
                            <div className="px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-200 flex items-center gap-2">
                                <span>
                                    {index + 1} / {visibleCards.length}
                                </span>
                                <span className="w-px h-3 bg-slate-700" />
                                <span>
                                    Đã thuộc:{' '}
                                    <span className="text-emerald-300 font-semibold">
                                        {learnedCount}
                                    </span>
                                    /{cards.length}
                                </span>
                            </div>
                        </div>

                        {/* Toggle learned */}
                        <div className="flex justify-center mt-3 text-sm">
                            <button
                                type="button"
                                onClick={toggleLearned}
                                className={`px-7 py-1.5 rounded-full border transition-colors ${currentLearned
                                    ? 'bg-emerald-500/15 border-emerald-400 text-emerald-100'
                                    : 'bg-sky-500/15 border-sky-400 text-sky-100'
                                    }`}
                            >
                                {currentLearned
                                    ? 'Đã thuộc'
                                    : 'Chưa thuộc'}
                            </button>
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between mt-4">
                            <button
                                onClick={prev}
                                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm hover:bg-slate-800"
                            >
                                ← Trước
                            </button>
                            <button
                                onClick={next}
                                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm hover:bg-slate-800"
                            >
                                Sau →
                            </button>
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}
