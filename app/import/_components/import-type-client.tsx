"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Code2, Layers, PencilLine, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type ImportKind = "flashcard" | "mcq"

interface ImportTypeClientProps {
  kind: ImportKind
}

interface DeckOption {
  id: string
  name: string
  subject: string
}

interface ManualFlashcardItem {
  id: string
  front: string
  back: string
  tags: string
}

interface ManualMcqChoice {
  text: string
  isCorrect: boolean
}

interface ManualMcqItem {
  id: string
  question: string
  explanation: string
  tags: string
  choices: ManualMcqChoice[]
}

type ImportResponse =
  | {
      flashcardCount?: number
      questionCount?: number
      deckName?: string
      error?: string
    }
  | null

type InsertResponse =
  | {
      insertedCount?: number
      error?: string
    }
  | null

const NEW_SUBJECT_VALUE = "__NEW_SUBJECT__"
const NEW_DECK_VALUE = "__NEW_DECK__"
const createChoiceId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const createDefaultChoices = (): ManualMcqChoice[] => [
  { text: "", isCorrect: true },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
]

const createEmptyFlashcard = (): ManualFlashcardItem => ({
  id: createChoiceId(),
  front: "",
  back: "",
  tags: "",
})

const createEmptyMcq = (): ManualMcqItem => ({
  id: createChoiceId(),
  question: "",
  explanation: "",
  tags: "",
  choices: createDefaultChoices(),
})

const normalizeKey = (value: string) => value.trim().toLowerCase()
const formatKind = (kind: ImportKind) =>
  kind === "flashcard" ? "Flashcard" : "MCQ"

const normalizeTagsInput = (value: string): string[] | undefined => {
  const tags = value
    .split(/[,\n]/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
  if (tags.length === 0) return undefined
  return Array.from(new Set(tags))
}

const getJsonPlaceholder = (kind: ImportKind) =>
  kind === "flashcard"
    ? `[
  { "front": "Định nghĩa suy tim?", "back": "Suy tim là..." }
]`
    : `[
  {
    "question": "Đâu là đáp án đúng?",
    "choices": [
      { "text": "Lựa chọn A", "isCorrect": true },
      { "text": "Lựa chọn B", "isCorrect": false }
    ]
  }
]`

function extractItemsByKind(kind: ImportKind, parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (!parsed || typeof parsed !== "object") return []
  const key = kind === "flashcard" ? "flashcards" : "questions"
  const items = (parsed as Record<string, unknown>)[key]
  return Array.isArray(items) ? items : []
}

export default function ImportTypeClient({ kind }: ImportTypeClientProps) {
  const { toast } = useToast()
  const kindLabel = formatKind(kind)

  const [subjectOptions, setSubjectOptions] = useState<string[]>([])
  const [deckOptions, setDeckOptions] = useState<DeckOption[]>([])
  const [subjectValue, setSubjectValue] = useState("")
  const [newSubject, setNewSubject] = useState("")
  const [deckValue, setDeckValue] = useState<string>(NEW_DECK_VALUE)
  const [newDeckName, setNewDeckName] = useState("")
  const [newDeckDescription, setNewDeckDescription] = useState("")

  const [manualFlashcards, setManualFlashcards] = useState<
    ManualFlashcardItem[]
  >(() => [createEmptyFlashcard()])
  const [manualMcqs, setManualMcqs] = useState<ManualMcqItem[]>(() => [
    createEmptyMcq(),
  ])

  const [jsonText, setJsonText] = useState("")
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [creatingManual, setCreatingManual] = useState(false)
  const [importingJson, setImportingJson] = useState(false)

  const activeSubject = useMemo(() => {
    if (subjectValue === NEW_SUBJECT_VALUE) return newSubject.trim()
    return subjectValue.trim()
  }, [newSubject, subjectValue])

  const decksInSubject = useMemo(() => {
    const subjectKey = normalizeKey(activeSubject)
    if (!subjectKey) return []
    return deckOptions
      .filter((deck) => normalizeKey(deck.subject) === subjectKey)
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
  }, [activeSubject, deckOptions])

  const selectedDeck = useMemo(
    () => decksInSubject.find((deck) => deck.id === deckValue),
    [deckValue, decksInSubject],
  )

  useEffect(() => {
    if (deckValue === NEW_DECK_VALUE) return
    if (decksInSubject.some((deck) => deck.id === deckValue)) return
    setDeckValue(NEW_DECK_VALUE)
  }, [deckValue, decksInSubject])

  useEffect(() => {
    let cancelled = false

    const loadMeta = async () => {
      try {
        setLoadingMeta(true)
        const [subjectRes, deckRes] = await Promise.all([
          fetch("/api/deck-parents"),
          fetch("/api/decks"),
        ])

        const subjectData = (await subjectRes.json().catch(() => null)) as
          | { parents?: unknown }
          | null
        const deckData = (await deckRes.json().catch(() => null)) as unknown
        if (cancelled) return

        const fetchedSubjects = Array.isArray(subjectData?.parents)
          ? subjectData.parents
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
          : []

        const fetchedDecks = Array.isArray(deckData)
          ? deckData
              .map((item) => ({
                id: typeof item?._id === "string" ? item._id : "",
                name:
                  typeof item?.name === "string" && item.name.trim()
                    ? item.name.trim()
                    : "Untitled deck",
                subject:
                  typeof item?.subject === "string" ? item.subject.trim() : "",
              }))
              .filter((item) => item.id)
          : []

        const mergedSubjects = Array.from(
          new Set(
            [...fetchedSubjects, ...fetchedDecks.map((deck) => deck.subject)]
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, "vi"))

        setSubjectOptions(mergedSubjects)
        setDeckOptions(fetchedDecks)
        setSubjectValue((prev) => prev || mergedSubjects[0] || "")
      } catch (error) {
        console.error(error)
        toast({
          variant: "destructive",
          title: "Không thể tải dữ liệu",
          description: "Vui lòng thử lại sau.",
        })
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    }

    void loadMeta()
    return () => {
      cancelled = true
    }
  }, [toast])

  const validateTarget = () => {
    if (!activeSubject) {
      toast({
        variant: "destructive",
        title: "Thiếu môn học",
        description: "Bạn cần chọn môn học.",
      })
      return false
    }

    if (deckValue === NEW_DECK_VALUE && !newDeckName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu bộ thẻ",
        description: "Nhập tên bộ thẻ mới.",
      })
      return false
    }

    if (deckValue !== NEW_DECK_VALUE && !selectedDeck) {
      toast({
        variant: "destructive",
        title: "Thiếu bộ thẻ",
        description: "Bạn cần chọn bộ thẻ.",
      })
      return false
    }

    return true
  }

  const createDeckForSubject = async () => {
    const res = await fetch("/api/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDeckName.trim(),
        description: newDeckDescription.trim(),
        subject: activeSubject,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(
        typeof data?.error === "string" ? data.error : "Tạo bộ thẻ thất bại",
      )
    }

    const deckId =
      typeof data?.deckId === "string"
        ? data.deckId
        : typeof data?.id === "string"
          ? data.id
          : ""
    if (!deckId) throw new Error("Không nhận được deckId")

    const createdDeck = {
      id: deckId,
      name: newDeckName.trim(),
      subject: activeSubject,
    }
    setDeckOptions((prev) =>
      prev.some((deck) => deck.id === deckId) ? prev : [...prev, createdDeck],
    )
    setDeckValue(deckId)
    setNewDeckName("")
    setNewDeckDescription("")
    if (subjectValue === NEW_SUBJECT_VALUE) {
      setSubjectValue(activeSubject)
      setNewSubject("")
    }
    return deckId
  }

  const ensureDeckId = async () => {
    if (!validateTarget()) return null
    if (deckValue !== NEW_DECK_VALUE) return deckValue
    return createDeckForSubject()
  }

  const handleCreateManual = async () => {
    try {
      setCreatingManual(true)
      const deckId = await ensureDeckId()
      if (!deckId) return

      if (kind === "flashcard") {
        const flashcards = manualFlashcards
          .map((item) => ({
            front: item.front.trim(),
            back: item.back.trim(),
            tags: normalizeTagsInput(item.tags),
          }))
          .filter((item) => item.front && item.back)

        if (flashcards.length === 0) throw new Error("Cần ít nhất 1 flashcard hợp lệ.")

        const res = await fetch("/api/flashcards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deckId,
            flashcards,
          }),
        })
        const data = (await res.json().catch(() => null)) as InsertResponse
        if (!res.ok) throw new Error(data?.error || "Tạo flashcard thất bại")

        toast({
          title: "Tạo flashcard thành công",
          description: `Đã thêm ${data?.insertedCount ?? flashcards.length} flashcard.`,
        })
        setManualFlashcards([createEmptyFlashcard()])
        return
      }

      const questions = manualMcqs
        .map((item) => {
          const question = item.question.trim()
          const choices = item.choices
            .map((choice) => ({
              text: choice.text.trim(),
              isCorrect: choice.isCorrect,
            }))
            .filter((choice) => choice.text)
          return {
            question,
            choices,
            explanation: item.explanation.trim() || undefined,
            tags: normalizeTagsInput(item.tags),
          }
        })
        .filter(
          (item) =>
            item.question &&
            item.choices.length >= 2 &&
            item.choices.some((choice) => choice.isCorrect),
        )

      if (questions.length === 0) throw new Error("Cần ít nhất 1 MCQ hợp lệ.")

      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckId,
          questions,
        }),
      })
      const data = (await res.json().catch(() => null)) as InsertResponse
      if (!res.ok) throw new Error(data?.error || "Tạo MCQ thất bại")

      toast({
        title: "Tạo MCQ thành công",
        description: `Đã thêm ${data?.insertedCount ?? questions.length} câu hỏi.`,
      })
      setManualMcqs([createEmptyMcq()])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Tạo ${kindLabel} thất bại`
      toast({
        variant: "destructive",
        title: `Tạo ${kindLabel} thất bại`,
        description: message,
      })
    } finally {
      setCreatingManual(false)
    }
  }

  const handleImportJson = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      toast({
        variant: "destructive",
        title: "JSON không hợp lệ",
        description: "Kiểm tra lại cú pháp JSON.",
      })
      return
    }

    const items = extractItemsByKind(kind, parsed)
    if (items.length === 0) {
      toast({
        variant: "destructive",
        title: "JSON không đúng định dạng",
        description:
          kind === "flashcard"
            ? "Cần mảng flashcards hoặc root array flashcard."
            : "Cần mảng questions hoặc root array MCQ.",
      })
      return
    }

    try {
      setImportingJson(true)
      const deckId = await ensureDeckId()
      if (!deckId) return

      const payload =
        kind === "flashcard"
          ? { deckId, subject: activeSubject, flashcards: items }
          : { deckId, subject: activeSubject, questions: items }

      const res = await fetch("/api/import/manual-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => null)) as ImportResponse
      if (!res.ok) throw new Error(data?.error || "Import JSON thất bại")

      const importedCount =
        kind === "flashcard"
          ? Number(data?.flashcardCount ?? 0)
          : Number(data?.questionCount ?? 0)

      toast({
        title: "Import JSON thành công",
        description: `Đã thêm ${importedCount} ${kindLabel}.`,
      })
      setJsonText("")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Import JSON thất bại"
      toast({
        variant: "destructive",
        title: "Import JSON thất bại",
        description: message,
      })
    } finally {
      setImportingJson(false)
    }
  }

  const isBusy = loadingMeta || creatingManual || importingJson
  const textareaBase =
    "w-full rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 placeholder:text-muted-foreground/60 resize-none overflow-hidden"

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }

  const updateManualFlashcard = (
    id: string,
    field: "front" | "back" | "tags",
    value: string,
  ) => {
    setManualFlashcards((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  }

  const addManualFlashcard = () => {
    setManualFlashcards((prev) => [...prev, createEmptyFlashcard()])
  }

  const removeManualFlashcard = (id: string) => {
    setManualFlashcards((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id !== id)
    })
  }

  const updateManualMcqField = (
    id: string,
    field: "question" | "explanation" | "tags",
    value: string,
  ) => {
    setManualMcqs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    )
  }

  const updateManualMcqChoiceText = (
    id: string,
    choiceIndex: number,
    value: string,
  ) => {
    setManualMcqs((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return {
          ...item,
          choices: item.choices.map((choice, index) =>
            index === choiceIndex ? { ...choice, text: value } : choice,
          ),
        }
      }),
    )
  }

  const setManualMcqCorrectChoice = (id: string, choiceIndex: number) => {
    setManualMcqs((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return {
          ...item,
          choices: item.choices.map((choice, index) => ({
            ...choice,
            isCorrect: index === choiceIndex,
          })),
        }
      }),
    )
  }

  const addManualMcqChoice = (id: string) => {
    setManualMcqs((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, choices: [...item.choices, { text: "", isCorrect: false }] }
          : item,
      ),
    )
  }

  const removeManualMcqChoice = (id: string, choiceIndex: number) => {
    setManualMcqs((prev) =>
      prev.map((item) => {
        if (item.id !== id || item.choices.length <= 2) return item
        const removedWasCorrect = item.choices[choiceIndex]?.isCorrect
        const choices = item.choices.filter((_, index) => index !== choiceIndex)
        if (removedWasCorrect && choices.length > 0 && !choices.some((c) => c.isCorrect)) {
          choices[0] = { ...choices[0], isCorrect: true }
        }
        return { ...item, choices }
      }),
    )
  }

  const addManualMcq = () => {
    setManualMcqs((prev) => [...prev, createEmptyMcq()])
  }

  const removeManualMcq = (id: string) => {
    setManualMcqs((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id !== id)
    })
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col gap-4 px-4 py-6 stagger">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2">
          <Link href="/import">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">
            Import {kindLabel}
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            Bắt buộc chọn môn học và bộ thẻ trước khi tạo {kindLabel}.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4" />
            1. Chọn môn học và bộ thẻ
          </CardTitle>
          <CardDescription>
            Chọn bộ thẻ có sẵn hoặc tạo bộ thẻ mới trong môn học đã chọn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">
              Môn học <span className="text-destructive">*</span>
            </label>
            <Select value={subjectValue} onValueChange={setSubjectValue} disabled={isBusy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn môn học" />
              </SelectTrigger>
              <SelectContent>
                {subjectOptions.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_SUBJECT_VALUE}>+ Tạo môn học mới</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {subjectValue === NEW_SUBJECT_VALUE && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Tên môn học mới <span className="text-destructive">*</span>
              </label>
              <Input
                value={newSubject}
                onChange={(event) => setNewSubject(event.target.value)}
                disabled={isBusy}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">
              Bộ thẻ <span className="text-destructive">*</span>
            </label>
            <Select value={deckValue} onValueChange={setDeckValue} disabled={isBusy || !activeSubject}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn bộ thẻ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_DECK_VALUE}>+ Tạo bộ thẻ mới</SelectItem>
                {decksInSubject.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>
                    {deck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {deckValue === NEW_DECK_VALUE && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Tên bộ thẻ mới <span className="text-destructive">*</span>
                </label>
                <Input
                  value={newDeckName}
                  onChange={(event) => setNewDeckName(event.target.value)}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Mô tả bộ thẻ</label>
                <Input
                  value={newDeckDescription}
                  onChange={(event) => setNewDeckDescription(event.target.value)}
                  disabled={isBusy}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="manual" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual" className="gap-2">
            <PencilLine className="h-4 w-4" />
            Cách 1 - Tạo thủ công
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-2">
            <Code2 className="h-4 w-4" />
            Cách 2 - Import JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PencilLine className="h-4 w-4" />
                2. Cách 1 - Tạo thủ công giống Edit set
              </CardTitle>
              <CardDescription>
                Nhập tay trực tiếp tại trang import, không mở trang Edit set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {kind === "flashcard" ? (
                <div className="space-y-4">
                  {manualFlashcards.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Thẻ {index + 1}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeManualFlashcard(item.id)}
                          disabled={isBusy || manualFlashcards.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Thuật ngữ
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[90px]")}
                            value={item.front}
                            onChange={(event) => {
                              autoResizeTextarea(event.currentTarget)
                              updateManualFlashcard(
                                item.id,
                                "front",
                                event.target.value,
                              )
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                            disabled={isBusy}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Định nghĩa
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[90px]")}
                            value={item.back}
                            onChange={(event) => {
                              autoResizeTextarea(event.currentTarget)
                              updateManualFlashcard(
                                item.id,
                                "back",
                                event.target.value,
                              )
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                            disabled={isBusy}
                          />
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Tags
                        </label>
                        <Input
                          value={item.tags}
                          onChange={(event) =>
                            updateManualFlashcard(item.id, "tags", event.target.value)
                          }
                          placeholder="vd: nội-khoa, tim-mạch"
                          disabled={isBusy}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addManualFlashcard}
                    disabled={isBusy}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm thẻ
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {manualMcqs.map((item, questionIndex) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm"
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Câu hỏi {questionIndex + 1}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeManualMcq(item.id)}
                          disabled={isBusy || manualMcqs.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Câu hỏi
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[90px]")}
                            value={item.question}
                            onChange={(event) => {
                              autoResizeTextarea(event.currentTarget)
                              updateManualMcqField(
                                item.id,
                                "question",
                                event.target.value,
                              )
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                            disabled={isBusy}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Đáp án
                          </label>
                          <div className="space-y-3">
                            {item.choices.map((choice, choiceIndex) => (
                              <div
                                key={`${item.id}-choice-${choiceIndex + 1}`}
                                className="rounded-xl border border-border/70 bg-muted/30 p-3"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 text-xs font-semibold text-muted-foreground">
                                    {String.fromCharCode(65 + choiceIndex)}
                                  </span>
                                  <Input
                                    className="flex-1"
                                    value={choice.text}
                                    onChange={(event) =>
                                      updateManualMcqChoiceText(
                                        item.id,
                                        choiceIndex,
                                        event.target.value,
                                      )
                                    }
                                    placeholder={`Đáp án ${choiceIndex + 1}`}
                                    disabled={isBusy}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={choice.isCorrect ? "default" : "outline"}
                                    onClick={() =>
                                      setManualMcqCorrectChoice(item.id, choiceIndex)
                                    }
                                    disabled={isBusy}
                                  >
                                    {choice.isCorrect ? "Đúng" : "Đánh dấu đúng"}
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      removeManualMcqChoice(item.id, choiceIndex)
                                    }
                                    disabled={isBusy || item.choices.length <= 2}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addManualMcqChoice(item.id)}
                            disabled={isBusy}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Thêm đáp án
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Giải thích
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[90px]")}
                            value={item.explanation}
                            onChange={(event) => {
                              autoResizeTextarea(event.currentTarget)
                              updateManualMcqField(
                                item.id,
                                "explanation",
                                event.target.value,
                              )
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                            disabled={isBusy}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Tags
                          </label>
                          <Input
                            value={item.tags}
                            onChange={(event) =>
                              updateManualMcqField(item.id, "tags", event.target.value)
                            }
                            placeholder="vd: nội-khoa, tim-mạch"
                            disabled={isBusy}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addManualMcq}
                    disabled={isBusy}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Thêm câu hỏi
                  </Button>
                </div>
              )}

              <Button
                type="button"
                onClick={() => void handleCreateManual()}
                disabled={isBusy}
              >
                {creatingManual ? "Đang tạo..." : `Lưu ${kindLabel}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="h-4 w-4" />
                3. Cách 2 - Import bằng JSON
              </CardTitle>
              <CardDescription>
                JSON có thể là root array hoặc object chứa key phù hợp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleImportJson}>
                <div className="space-y-1">
                  <label className="text-sm font-medium">JSON {kindLabel}</label>
                  <textarea
                    className="h-72 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none ring-0 focus-visible:border-primary"
                    value={jsonText}
                    onChange={(event) => setJsonText(event.target.value)}
                    placeholder={getJsonPlaceholder(kind)}
                    disabled={isBusy}
                  />
                </div>
                <Button type="submit" disabled={isBusy || !jsonText.trim()}>
                  {importingJson ? "Đang import JSON..." : `Import ${kindLabel} JSON`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}


