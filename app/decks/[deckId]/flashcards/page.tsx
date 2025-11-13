// app/decks/[deckId]/flashcards/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface Flashcard {
    _id: string
    front: string
    back: string
}

export default function FlashcardStudyPage() {
    const params = useParams<{ deckId: string }>()
    const router = useRouter()
    const deckId = params.deckId

    const [cards, setCards] = useState<Flashcard[]>([])
    const [index, setIndex] = useState(0)
    const [showBack, setShowBack] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchCards = async () => {
            setLoading(true)
            const res = await fetch(`/api/flashcards?deckId=${deckId}`)
            const data = await res.json()
            setCards(data)
            setIndex(0)
            setShowBack(false)
            setLoading(false)
        }
        if (deckId) fetchCards()
    }, [deckId])

    const hasCards = cards.length > 0
    const current = hasCards ? cards[index] : null

    const next = () => {
        if (!cards.length) return
        setShowBack(false)
        setIndex(prev => (prev + 1) % cards.length)
    }

    const prev = () => {
        if (!cards.length) return
        setShowBack(false)
        setIndex(prev => (prev - 1 + cards.length) % cards.length)
    }

    const progress = hasCards ? ((index + 1) / cards.length) * 100 : 0

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
            <div className="w-full max-w-xl px-4 py-8 space-y-5">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push('/decks')}
                        className="text-sm text-slate-400 hover:text-slate-200"
                    >
                        ← Quay lại danh sách deck
                    </button>
                    <div className="text-xs text-slate-400">
                        {hasCards && (
                            <>
                                Thẻ{' '}
                                <span className="font-semibold">
                                    {index + 1}/{cards.length}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                {hasCards && (
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {loading && <p>Đang tải flashcard...</p>}

                {!loading && !hasCards && (
                    <p className="text-slate-400">
                        Deck này chưa có flashcard. Hãy import từ /import/cloze hoặc
                        /import/qa.
                    </p>
                )}

                {hasCards && current && (
                    <>
                        <div className="flex justify-center">
                            <div
                                className="w-full max-w-md h-60 [perspective:1000px]"
                                onClick={() => setShowBack(s => !s)}
                            >
                                <AnimatePresence mode="wait" initial={false}>
                                    <motion.div
                                        key={showBack ? 'back' : 'front'}
                                        initial={{ rotateY: 90, opacity: 0 }}
                                        animate={{ rotateY: 0, opacity: 1 }}
                                        exit={{ rotateY: -90, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="w-full h-full cursor-pointer select-none bg-slate-900 border border-slate-700 rounded-2xl shadow-xl flex flex-col justify-center items-center px-6 text-center"
                                    >
                                        <p className="text-xs text-slate-400 mb-2">
                                            {showBack ? 'Mặt sau (đáp án)' : 'Mặt trước (câu hỏi)'} – bấm để lật thẻ
                                        </p>
                                        <p className="text-lg whitespace-pre-wrap">
                                            {showBack ? current.back : current.front}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex justify-between mt-4">
                            <button
                                onClick={prev}
                                className="px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm hover:bg-slate-800"
                            >
                                ← Trước
                            </button>
                            <button
                                onClick={() => setShowBack(s => !s)}
                                className="px-4 py-2 rounded-md bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400"
                            >
                                {showBack ? 'Xem lại câu hỏi' : 'Xem đáp án'}
                            </button>
                            <button
                                onClick={next}
                                className="px-4 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm hover:bg-slate-800"
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
