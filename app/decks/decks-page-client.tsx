// app/decks/decks-page-client.tsx
"use client"

import Link from "next/link"
import { motion } from "framer-motion"

export type DeckItem = {
    _id: string
    name: string
    description?: string
    subject?: string
    createdAt: string
    updatedAt: string
}

export function DecksPageClient({ initialDecks }: { initialDecks: DeckItem[] }) {
    const decks = initialDecks ?? []

    return (
        <main className="flex min-h-[calc(100vh-4rem)] justify-center bg-background text-foreground">
            <div className="w-full max-w-5xl space-y-6 px-4 py-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Bộ thẻ của bạn
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Chọn bộ thẻ để học flashcard hoặc làm trắc nghiệm.
                        </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Tổng bộ thẻ:{" "}
                        <span className="font-semibold">{decks.length}</span>
                    </div>
                </div>

                {decks.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Chưa có bộ thẻ nào. Hãy import từ{" "}
                        <span className="font-semibold">/import/cloze</span>,{" "}
                        <span className="font-semibold">/import/qa</span> hoặc{" "}
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
                            className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg"
                        >
                            <div className="mb-4 space-y-1">
                                <h2 className="text-lg font-semibold">{deck.name}</h2>
                                {deck.subject && (
                                    <p className="text-xs text-slate-400">{deck.subject}</p>
                                )}
                                {deck.description && (
                                    <p className="line-clamp-3 text-xs text-slate-500">
                                        {deck.description}
                                    </p>
                                )}
                            </div>

                            <div className="mt-auto flex gap-2">
                                <Link
                                    href={`/decks/${deck._id}/flashcards`}
                                    className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
                                >
                                    Học flashcard
                                </Link>
                                <Link
                                    href={`/decks/${deck._id}/mcq`}
                                    className="flex-1 rounded-xl bg-sky-500 px-3 py-2 text-center text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400"
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
