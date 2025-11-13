// app/decks/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

interface Deck {
    _id: string
    name: string
    description?: string
    subject?: string
}

export default function DeckListPage() {
    const [decks, setDecks] = useState<Deck[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchDecks = async () => {
            const res = await fetch('/api/decks')
            const data = await res.json()
            setDecks(data)
            setLoading(false)
        }
        fetchDecks()
    }, [])

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex justify-center">
            <div className="w-full max-w-4xl px-4 py-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Deck của bạn</h1>
                        <p className="text-sm text-slate-400">
                            Chọn deck để học flashcard hoặc làm trắc nghiệm.
                        </p>
                    </div>
                    <div className="text-xs text-slate-500">
                        Tổng deck: <span className="font-semibold">{decks.length}</span>
                    </div>
                </div>

                {loading && <p>Đang tải...</p>}

                {!loading && decks.length === 0 && (
                    <p className="text-slate-400">
                        Chưa có deck nào. Hãy import từ{' '}
                        <span className="font-semibold">/import/cloze</span>,{' '}
                        <span className="font-semibold">/import/qa</span> hoặc{' '}
                        <span className="font-semibold">/import/mcq</span>.
                    </p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    {decks.map((deck, i) => (
                        <motion.div
                            key={deck._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="border border-slate-800 bg-slate-900/70 rounded-2xl p-4 flex flex-col justify-between shadow-lg"
                        >
                            <div className="space-y-1 mb-4">
                                <h2 className="font-semibold text-lg">{deck.name}</h2>
                                {deck.subject && (
                                    <p className="text-xs text-slate-400">{deck.subject}</p>
                                )}
                                {deck.description && (
                                    <p className="text-xs text-slate-500">
                                        {deck.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 mt-auto">
                                <Link
                                    href={`/decks/${deck._id}/flashcards`}
                                    className="flex-1 text-center px-3 py-2 rounded-md bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 transition-colors"
                                >
                                    Học flashcard
                                </Link>
                                <Link
                                    href={`/decks/${deck._id}/mcq`}
                                    className="flex-1 text-center px-3 py-2 rounded-md bg-sky-500 text-slate-950 text-sm font-semibold hover:bg-sky-400 transition-colors"
                                >
                                    Trắc nghiệm
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </main>
    )
}
