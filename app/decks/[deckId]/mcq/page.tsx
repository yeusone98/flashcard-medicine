'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

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

export default function MCQPage() {
    const params = useParams<{ deckId: string }>()
    const router = useRouter()
    const deckId = params.deckId

    const [questions, setQuestions] = useState<Question[]>([])
    const [index, setIndex] = useState(0)
    const [answers, setAnswers] = useState<AnswerState[]>([])
    const [loading, setLoading] = useState(true)
    const [deckName, setDeckName] = useState('')

    const [isSubmitted, setIsSubmitted] = useState(false)
    const [showSubmitModal, setShowSubmitModal] = useState(false)
    const [reviewMode, setReviewMode] = useState<'all' | 'wrong'>('all')

    // Lấy deck name + câu hỏi
    useEffect(() => {
        const fetchAll = async () => {
            setLoading(true)

            // Deck name (để hiện tiêu đề)
            const deckRes = await fetch('/api/decks')
            const deckList = await deckRes.json()
            const deck = deckList.find((d: any) => d._id === deckId)
            setDeckName(deck?.name || '')

            // Questions
            const res = await fetch(`/api/questions?deckId=${deckId}`)
            const data: Question[] = await res.json()
            setQuestions(data)
            setIndex(0)
            setAnswers(
                data.map(() => ({
                    selectedIndex: null,
                    isCorrect: null,
                }))
            )
            setLoading(false)
            setIsSubmitted(false)
            setShowSubmitModal(false)
            setReviewMode('all')
        }

        if (deckId) fetchAll()
    }, [deckId])

    const hasQuestions = questions.length > 0
    const current = hasQuestions ? questions[index] : null
    const total = questions.length

    const unansweredCount = answers.filter(a => a.selectedIndex === null).length
    const correctCount = answers.filter(a => a.isCorrect === true).length
    const wrongCount = answers.filter(a => a.isCorrect === false).length
    const answeredCount = total - unansweredCount
    const percent = total ? Math.round((correctCount / total) * 100) : 0
    const score10 = total ? (correctCount / total) * 10 : 0

    const progress = hasQuestions ? ((index + 1) / questions.length) * 100 : 0

    // Lọc index câu theo chế độ xem (tất cả / chỉ câu sai sau khi nộp)
    const getFilteredIndices = () => {
        if (!isSubmitted || reviewMode === 'all') {
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
        filteredIndices.length === 0
            ? true
            : currentFilteredPos <= 0
    const isLastInView =
        filteredIndices.length === 0
            ? true
            : currentFilteredPos === filteredIndices.length - 1

    // Chọn đáp án (trước khi nộp chỉ lưu lại, không show đúng/sai)
    const handleSelect = (i: number) => {
        if (!current || isSubmitted) return

        setAnswers(prev => {
            const copy = [...prev]
            const isCorrect = current.choices[i].isCorrect
            copy[index] = { selectedIndex: i, isCorrect }
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
        // Nếu đang không ở trong list filter (edge case) -> nhảy về câu đầu trong list
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

    const handleMainButton = () => {
        if (!hasQuestions) return
        if (index < questions.length - 1) {
            // Khi chưa nộp thì next đi theo index full
            setIndex(prev => Math.min(prev + 1, questions.length - 1))
        } else {
            // Câu cuối -> mở popup nộp bài
            setShowSubmitModal(true)
        }
    }

    const confirmSubmit = () => {
        setIsSubmitted(true)
        setShowSubmitModal(false)
        setReviewMode('all')
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
            }))
        )
        setIsSubmitted(false)
        setIndex(0)
        setReviewMode('all')
    }

    const handleChangeReviewMode = (mode: 'all' | 'wrong') => {
        setReviewMode(mode)
        if (mode === 'wrong' && isSubmitted) {
            const firstWrongIndex = answers.findIndex(a => a?.isCorrect === false)
            if (firstWrongIndex !== -1) {
                setIndex(firstWrongIndex)
            }
        }
    }

    // disable nút theo mode
    const isPrevDisabled = !hasQuestions || (!isSubmitted && index === 0) || (isSubmitted && isFirstInView)
    const isNextDisabled = !hasQuestions || (isSubmitted && isLastInView)

    // List index dùng để render danh sách câu hỏi
    const questionIndicesForList =
        !isSubmitted || reviewMode === 'all'
            ? questions.map((_, i) => i)
            : filteredIndices

    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100 flex items-center justify-center py-6">
            <div className="w-full max-w-5xl px-4 md:px-6">
                <div className="relative rounded-3xl border border-slate-800/80 bg-slate-900/70 shadow-2xl shadow-sky-950/50 backdrop-blur-xl px-5 md:px-8 py-6 md:py-8 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4">
                        <button
                            onClick={() => router.push('/decks')}
                            className="text-xs md:text-sm inline-flex items-center gap-1 text-slate-400 hover:text-slate-100 hover:-translate-x-0.5 transition-transform"
                        >
                            <span>←</span>
                            <span>Deck của bạn</span>
                        </button>

                        <div className="text-right space-y-1">
                            <p className="text-[11px] uppercase text-sky-400 tracking-[0.2em]">
                                Trắc nghiệm
                            </p>
                            <p className="text-sm md:text-base font-semibold">
                                {deckName || 'Deck không tên'}
                            </p>
                            <p className="mt-1 text-[11px] inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-300">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {isSubmitted ? 'Đã nộp bài · Đang xem lại' : 'Đang làm bài'}
                            </p>
                        </div>
                    </div>

                    {/* Progress */}
                    {hasQuestions && (
                        <div className="w-full">
                            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                                <span>Tiến độ</span>
                                <span>
                                    {index + 1}/{questions.length} câu
                                </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-blue-500 transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {loading && (
                        <p className="text-slate-400 text-sm">
                            Đang tải câu hỏi...
                        </p>
                    )}

                    {!loading && !hasQuestions && (
                        <p className="text-slate-400 text-sm">
                            Deck này chưa có câu hỏi trắc nghiệm. Hãy import từ{' '}
                            <span className="font-mono text-sky-300">/import/mcq</span>.
                        </p>
                    )}

                    {/* Câu hỏi hiện tại */}
                    {hasQuestions && current && (
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={current._id + index}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4 md:space-y-5 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 md:px-6 py-4 md:py-5 shadow-inner shadow-slate-950/60"
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h1 className="text-lg md:text-xl font-semibold tracking-tight">
                                            Câu hỏi
                                        </h1>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {isSubmitted
                                                ? 'Đang xem lại kết quả'
                                                : 'Chọn đáp án và làm đến hết để nộp bài'}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs text-slate-400">
                                            Câu hiện tại
                                        </span>
                                        <span className="text-sm font-semibold text-sky-300">
                                            {index + 1}/{questions.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-3">
                                    <h2 className="text-base md:text-lg font-semibold leading-relaxed">
                                        {current.question}
                                    </h2>
                                </div>

                                <div className="space-y-2">
                                    {current.choices.map((choice, i) => {
                                        const isCorrect = choice.isCorrect
                                        const state = answers[index]
                                        const isSelected = state?.selectedIndex === i

                                        let base =
                                            'w-full text-left px-4 py-2.5 rounded-lg border text-sm md:text-[15px] transition-all flex items-center gap-2'
                                        let color =
                                            'bg-slate-950/60 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'

                                        if (!isSubmitted) {
                                            // Chưa nộp: chỉ tô màu đáp án đã chọn
                                            if (isSelected) {
                                                color =
                                                    'bg-slate-900 border-slate-600 text-slate-50 shadow-sm shadow-slate-900'
                                            }
                                        } else {
                                            // Đã nộp: hiện xanh/đỏ theo đúng sai
                                            if (isCorrect) {
                                                color =
                                                    'bg-emerald-900/40 border-emerald-500/70 text-emerald-100 shadow-sm shadow-emerald-900/60'
                                            } else if (isSelected && !isCorrect) {
                                                color =
                                                    'bg-rose-900/40 border-rose-500/70 text-rose-100 shadow-sm shadow-rose-900/60'
                                            } else {
                                                color =
                                                    'bg-slate-950/40 border-slate-800 text-slate-500'
                                            }
                                        }

                                        return (
                                            <button
                                                key={i}
                                                className={`${base} ${color}`}
                                                onClick={() => handleSelect(i)}
                                                disabled={isSubmitted}
                                            >
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-600 text-[11px]">
                                                    {String.fromCharCode(65 + i)}
                                                </span>
                                                <span className="flex-1 text-left">
                                                    {choice.text}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Sau NỘP BÀI mới show đáp án + giải thích */}
                                {isSubmitted && (
                                    <div className="mt-3 text-sm space-y-1 rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-3">
                                        <p>
                                            <span className="font-semibold text-emerald-400">
                                                Đáp án đúng:{' '}
                                            </span>
                                            {
                                                current.choices.find(c => c.isCorrect)?.text ??
                                                'Chưa đánh dấu isCorrect trong dữ liệu'
                                            }
                                        </p>
                                        {current.explanation && (
                                            <p className="text-slate-300">
                                                <span className="font-semibold">
                                                    Giải thích:{' '}
                                                </span>
                                                {current.explanation}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Điều hướng câu hỏi */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mt-4">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={prevQuestion}
                                            disabled={isPrevDisabled}
                                            className="px-4 py-2 rounded-lg bg-slate-950/70 border border-slate-700 text-xs md:text-sm hover:bg-slate-900 hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            ← Câu trước
                                        </button>

                                        <button
                                            onClick={isSubmitted ? nextQuestion : handleMainButton}
                                            disabled={isSubmitted && isNextDisabled}
                                            className="px-4 py-2 rounded-lg bg-sky-600/90 border border-sky-400 text-xs md:text-sm font-medium text-slate-950 hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitted
                                                ? isLastInView
                                                    ? 'Hết câu để xem'
                                                    : 'Câu tiếp →'
                                                : index < questions.length - 1
                                                    ? 'Câu tiếp →'
                                                    : 'Nộp bài'}
                                        </button>
                                    </div>

                                    {isSubmitted && (
                                        <button
                                            onClick={resetQuiz}
                                            className="self-start md:self-auto px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 text-[11px] md:text-xs text-slate-200 hover:bg-slate-800"
                                        >
                                            Làm lại bài
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    )}

                    {/* Kết quả + list câu hỏi */}
                    {hasQuestions && (
                        <div className="mt-4 border-t border-slate-800/80 pt-4 flex flex-col md:flex-row gap-5">
                            {/* Kết quả */}
                            <div className="md:w-1/3 space-y-3 text-sm">
                                <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-4 py-3">
                                    <p className="font-semibold mb-1.5">Kết quả</p>

                                    {!isSubmitted && (
                                        <>
                                            <p className="text-sm">
                                                Đã chọn:{' '}
                                                <span className="font-semibold">
                                                    {answeredCount}/{total}
                                                </span>
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Hoàn thành tất cả câu rồi nhấn{' '}
                                                <span className="font-semibold">
                                                    Nộp bài
                                                </span>{' '}
                                                để xem điểm và đáp án đúng/sai.
                                            </p>
                                        </>
                                    )}

                                    {isSubmitted && (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-2xl font-semibold text-emerald-400">
                                                    {score10.toFixed(1)}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    / 10 điểm · {percent}%
                                                </span>
                                            </div>
                                            <p className="mt-1.5">
                                                Đã làm:{' '}
                                                <span className="font-semibold">
                                                    {answeredCount}/{total}
                                                </span>
                                            </p>
                                            <p>
                                                Đúng:{' '}
                                                <span className="font-semibold text-emerald-400">
                                                    {correctCount}
                                                </span>{' '}
                                                – Sai:{' '}
                                                <span className="font-semibold text-rose-400">
                                                    {answeredCount - correctCount}
                                                </span>
                                            </p>

                                            {/* Chế độ xem: tất cả / chỉ câu sai */}
                                            <div className="mt-3 space-y-1.5">
                                                <p className="text-[11px] text-slate-400">
                                                    Chế độ xem câu hỏi:
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        onClick={() =>
                                                            handleChangeReviewMode('all')
                                                        }
                                                        className={`px-3 py-1.5 rounded-full text-[11px] border ${reviewMode === 'all'
                                                                ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                                                                : 'bg-slate-950/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                                                            }`}
                                                    >
                                                        Tất cả câu
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleChangeReviewMode('wrong')
                                                        }
                                                        disabled={wrongCount === 0}
                                                        className={`px-3 py-1.5 rounded-full text-[11px] border flex items-center gap-1.5 ${reviewMode === 'wrong'
                                                                ? 'bg-rose-500/20 border-rose-400 text-rose-100'
                                                                : 'bg-slate-950/60 border-slate-700 text-slate-300 hover:bg-slate-900'
                                                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                                                    >
                                                        Chỉ câu sai
                                                        {wrongCount > 0 && (
                                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500/80 text-[10px] text-slate-950">
                                                                {wrongCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Nút làm lại bài (thêm ở đây cho dễ thấy) */}
                                            <button
                                                onClick={resetQuiz}
                                                className="mt-3 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-700 text-[11px] text-slate-200 hover:bg-slate-900"
                                            >
                                                Làm lại bài từ đầu
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* List câu hỏi */}
                            <div className="md:flex-1">
                                <p className="text-sm font-semibold mb-2 flex items-center justify-between">
                                    <span>Danh sách câu hỏi</span>
                                    {isSubmitted && reviewMode === 'wrong' && (
                                        <span className="text-[11px] text-rose-300">
                                            Đang hiển thị các câu trả lời sai
                                        </span>
                                    )}
                                </p>
                                <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-3 py-3">
                                    {questionIndicesForList.length === 0 && isSubmitted && reviewMode === 'wrong' ? (
                                        <p className="text-xs text-slate-400">
                                            Bạn không có câu nào sai 🎉
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {questionIndicesForList.map(i => {
                                                const state = answers[i]
                                                const isCurrent = i === index

                                                let color =
                                                    'bg-slate-800 text-slate-200 border border-slate-700' // mặc định

                                                if (!isSubmitted) {
                                                    // Chưa nộp: câu đã làm -> màu xanh dương, chưa làm -> xám
                                                    if (state?.selectedIndex !== null) {
                                                        color =
                                                            'bg-sky-600 text-slate-950 border border-sky-400'
                                                    } else {
                                                        color =
                                                            'bg-slate-900 text-slate-400 border border-slate-700'
                                                    }
                                                } else {
                                                    // Đã nộp: dùng xanh/đỏ theo đúng sai
                                                    if (state?.isCorrect === true) {
                                                        color =
                                                            'bg-emerald-500 text-slate-950 border border-emerald-300'
                                                    } else if (state?.isCorrect === false) {
                                                        color =
                                                            'bg-rose-500 text-slate-950 border border-rose-300'
                                                    } else {
                                                        color =
                                                            'bg-slate-900 text-slate-400 border border-slate-700'
                                                    }
                                                }

                                                let ring = ''
                                                if (isCurrent) {
                                                    ring =
                                                        ' ring-2 ring-offset-2 ring-offset-slate-950 ring-sky-300'
                                                }

                                                return (
                                                    <button
                                                        key={i}
                                                        className={`w-9 h-9 rounded-full text-xs md:text-sm flex items-center justify-center ${color}${ring}`}
                                                        onClick={() => goToQuestion(i)}
                                                    >
                                                        {i + 1}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Popup nộp bài */}
                    {showSubmitModal && (
                        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-slate-950 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl shadow-black/70"
                            >
                                <h2 className="text-lg font-semibold">
                                    Nộp bài kiểm tra?
                                </h2>

                                {unansweredCount > 0 ? (
                                    <p className="text-sm text-slate-300">
                                        Bạn còn{' '}
                                        <span className="font-semibold text-amber-300">
                                            {unansweredCount}/{total}
                                        </span>{' '}
                                        câu chưa làm. Bạn có chắc chắn muốn nộp bài không?
                                    </p>
                                ) : (
                                    <p className="text-sm text-slate-300">
                                        Bạn đã làm đầy đủ{' '}
                                        <span className="font-semibold text-emerald-300">
                                            {total}/{total}
                                        </span>{' '}
                                        câu. Xác nhận nộp bài để xem điểm và đáp án chi tiết.
                                    </p>
                                )}

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={cancelSubmit}
                                        className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm hover:bg-slate-800"
                                    >
                                        Kiểm tra lại
                                    </button>
                                    <button
                                        onClick={confirmSubmit}
                                        className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400"
                                    >
                                        Nộp bài
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
