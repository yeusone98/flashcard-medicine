// app/decks/[deckId]/edit/page.tsx
"use client"

import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  useCallback,
  useRef,
} from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  GripVertical,
  Image,
  Loader2,
  Plus,
  Save,
  Trash2,
  Volume2,
  X,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface DeckInfo {
  _id: string
  name?: string
  description?: string
  subject?: string
}

type FieldItem = {
  key: string
  value: string
}

interface FlashcardItem {
  clientId: string
  _id?: string
  front: string
  back: string
  frontImage?: string
  backImage?: string
  frontAudio?: string
  backAudio?: string
  fields: FieldItem[]
  tags: string[]
  order?: number
  isSaving?: boolean
}

interface ChoiceItem {
  text: string
  isCorrect: boolean
  image?: string
}

interface QuestionItem {
  clientId: string
  _id?: string
  question: string
  explanation?: string
  image?: string
  choices: ChoiceItem[]
  tags: string[]
  order?: number
  isSaving?: boolean
}

export default function EditDeckPage() {
  const params = useParams<{ deckId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const deckId = params.deckId
  const subjectParam = searchParams.get("subject") ?? ""
  const subject = subjectParam.trim()

  const [deck, setDeck] = useState<DeckInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([])
  const [draggingFlashIndex, setDraggingFlashIndex] = useState<number | null>(null)
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [draggingQuestionIndex, setDraggingQuestionIndex] = useState<number | null>(null)
  const [dirtyFlashcards, setDirtyFlashcards] = useState<Set<string>>(new Set())
  const [dirtyQuestions, setDirtyQuestions] = useState<Set<string>>(new Set())

  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState("")
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [openFlashcardImages, setOpenFlashcardImages] = useState<Record<string, boolean>>({})
  const [openQuestionImages, setOpenQuestionImages] = useState<Record<string, boolean>>({})

  const [flashcardSearch, setFlashcardSearch] = useState("")
  const [flashcardTagFilter, setFlashcardTagFilter] = useState("")
  const [questionSearch, setQuestionSearch] = useState("")
  const [questionTagFilter, setQuestionTagFilter] = useState("")
  const [selectedFlashcards, setSelectedFlashcards] = useState<Set<string>>(new Set())
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set())
  const [bulkFlashcardTags, setBulkFlashcardTags] = useState("")
  const [bulkFlashcardRemoveTags, setBulkFlashcardRemoveTags] = useState("")
  const [bulkQuestionTags, setBulkQuestionTags] = useState("")
  const [bulkQuestionRemoveTags, setBulkQuestionRemoveTags] = useState("")

  const flashcardsRef = useRef<FlashcardItem[]>([])
  const questionsRef = useRef<QuestionItem[]>([])
  const flashAutosaveTimers = useRef<Record<string, number>>({})
  const questionAutosaveTimers = useRef<Record<string, number>>({})
  const pendingDeletes = useRef<
    Record<
      string,
      {
        type: "flashcard" | "question"
        item: FlashcardItem | QuestionItem
        index: number
        timer: number
        wasDirty: boolean
      }
    >
  >({})

  const deckName = deck?.name || "Deck"
  const textareaBase =
    "w-full rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/20 placeholder:text-muted-foreground/60 resize-none overflow-hidden"

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "0px"
    el.style.height = `${el.scrollHeight}px`
  }

  const AUTO_SAVE_MS = 1200
  const UNDO_TIMEOUT_MS = 5000

  const normalizeTagsInput = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[,\n]/)
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
      ),
    )

  const tagsToInput = (tags: string[]) => tags.join(", ")

  const recordToFields = (record: unknown): FieldItem[] => {
    if (!record || typeof record !== "object") return []
    return Object.entries(record as Record<string, unknown>).map(
      ([key, value]) => ({
        key,
        value:
          typeof value === "string"
            ? value
            : value === null || value === undefined
              ? ""
              : String(value),
      }),
    )
  }

  const normalizeFieldsInput = (
    fields: FieldItem[],
  ): Record<string, string> | undefined => {
    const output: Record<string, string> = {}
    fields.forEach(({ key, value }) => {
      const trimmedKey = key.trim()
      if (!trimmedKey) return
      output[trimmedKey] = value
    })
    return Object.keys(output).length > 0 ? output : undefined
  }

  const mergeTags = (current: string[], incoming: string[]) =>
    Array.from(new Set([...current, ...incoming]))

  const removeTags = (current: string[], removing: string[]) =>
    current.filter((tag) => !removing.includes(tag))

  const normalizeSearch = (value: string) => value.trim().toLowerCase()

  const createClientId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const markFlashcardDirty = useCallback((key: string) => {
    setDirtyFlashcards((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const clearFlashcardDirty = useCallback((key: string) => {
    setDirtyFlashcards((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const markQuestionDirty = useCallback((key: string) => {
    setDirtyQuestions((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const clearQuestionDirty = useCallback((key: string) => {
    setDirtyQuestions((prev) => {
      if (!prev.has(key)) return prev
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  const hasUnsavedChanges =
    dirtyFlashcards.size > 0 || dirtyQuestions.size > 0

  const confirmLeave = useCallback(() => {
    if (!hasUnsavedChanges) return true
    return window.confirm(
      "Bạn đang có thay đổi chưa lưu. Bạn chắc chắn muốn rời trang?",
    )
  }, [hasUnsavedChanges])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [hasUnsavedChanges])

  useEffect(() => {
    if (!deckId) return

    const loadData = async () => {
      try {
        setLoading(true)
        const [deckRes, flashRes, questionRes] = await Promise.all([
          fetch(`/api/decks/${deckId}`),
          fetch(`/api/flashcards?deckId=${deckId}`),
          fetch(`/api/questions?deckId=${deckId}`),
        ])

        if (deckRes.ok) {
          const deckData = (await deckRes.json()) as DeckInfo
          setDeck(deckData)
        }

        if (flashRes.ok) {
          const flashData = (await flashRes.json()) as any[]
          setFlashcards(
            flashData.map((card) => ({
              clientId: typeof card._id === "string" ? card._id : createClientId(),
              _id: card._id,
              front: String(card.front ?? ""),
              back: String(card.back ?? ""),
              frontImage:
                typeof card.frontImage === "string"
                  ? card.frontImage
                  : typeof card.frontImageUrl === "string"
                    ? card.frontImageUrl
                    : "",
              backImage:
                typeof card.backImage === "string"
                  ? card.backImage
                  : typeof card.backImageUrl === "string"
                    ? card.backImageUrl
                    : "",
              frontAudio: typeof card.frontAudio === "string" ? card.frontAudio : "",
              backAudio: typeof card.backAudio === "string" ? card.backAudio : "",
              fields: recordToFields(card.fields),
              tags: Array.isArray(card.tags)
                ? card.tags
                    .filter((tag: unknown) => typeof tag === "string")
                    .map((tag: string) => tag.trim().toLowerCase())
                    .filter(Boolean)
                : [],
              order: typeof card.order === "number" ? card.order : undefined,
            })),
          )
        }

        if (questionRes.ok) {
          const questionData = (await questionRes.json()) as any[]
          setQuestions(
            questionData.map((q) => ({
              clientId: typeof q._id === "string" ? q._id : createClientId(),
              _id: q._id,
              question: String(q.question ?? ""),
              explanation: typeof q.explanation === "string" ? q.explanation : "",
              image:
                typeof q.image === "string"
                  ? q.image
                  : typeof q.imageUrl === "string"
                    ? q.imageUrl
                    : "",
              order: typeof q.order === "number" ? q.order : undefined,
              tags: Array.isArray(q.tags)
                ? q.tags
                    .filter((tag: unknown) => typeof tag === "string")
                    .map((tag: string) => tag.trim().toLowerCase())
                    .filter(Boolean)
                : [],
              choices: Array.isArray(q.choices)
                ? q.choices.map((c: any) => ({
                    text: String(c.text ?? ""),
                    isCorrect: Boolean(c.isCorrect),
                    image: typeof c.image === "string" ? c.image : "",
                  }))
                : [],
            })),
          )
        }

        setDirtyFlashcards(new Set())
        setDirtyQuestions(new Set())
        setSelectedFlashcards(new Set())
        setSelectedQuestions(new Set())
      } catch (error) {
        console.error(error)
        toast({
          variant: "destructive",
          title: "Load failed",
          description: "Could not load deck data.",
        })
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [deckId, toast])

  useEffect(() => {
    flashcardsRef.current = flashcards
  }, [flashcards])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const flashcardCount = flashcards.length
  const questionCount = questions.length

  const getFlashcardKey = (card: FlashcardItem) => card.clientId
  const getQuestionKey = (question: QuestionItem) => question.clientId
  const isUploading = (key: string) => Boolean(uploading[key])

  const toggleFlashcardImages = (key: string) => {
    setOpenFlashcardImages((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleQuestionImages = (key: string) => {
    setOpenQuestionImages((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const uploadImageFile = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/uploads/image", {
      method: "POST",
      body: formData,
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(data?.error || "Image upload failed")
    }

    const url = typeof data?.url === "string" ? data.url : ""
    if (!url) {
      throw new Error("No image URL returned")
    }

    return url
  }

  const uploadAudioFile = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("kind", "audio")

    const res = await fetch("/api/media/upload", {
      method: "POST",
      body: formData,
    })

    const data = await res.json().catch(() => null)

    if (!res.ok) {
      throw new Error(data?.error || "Audio upload failed")
    }

    const url = typeof data?.media?.url === "string" ? data.media.url : ""
    if (!url) {
      throw new Error("No audio URL returned")
    }

    return url
  }

  const handleGlobalImageUpload = async (file: File | null) => {
    if (!file) return

    try {
      setUploadingImage(true)
      const url = await uploadImageFile(file)
      setUploadedImageUrl(url)
      toast({
        title: "Image uploaded",
        description: "Copy the URL and paste into image fields.",
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image upload failed"
      toast({
        variant: "destructive",
        title: "Upload error",
        description: message,
      })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFieldImageUpload = async (
    key: string,
    file: File | null,
    onUrl: (url: string) => void,
  ) => {
    if (!file) return

    try {
      setUploading((prev) => ({ ...prev, [key]: true }))
      const url = await uploadImageFile(file)
      onUrl(url)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image upload failed"
      toast({
        variant: "destructive",
        title: "Upload error",
        description: message,
      })
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleCopyImageUrl = async () => {
    if (!uploadedImageUrl) return
    try {
      await navigator.clipboard.writeText(uploadedImageUrl)
      toast({
        title: "Copied",
        description: "Image URL copied to clipboard.",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Could not copy the image URL.",
      })
    }
  }

  const setFlashcardSaving = (clientId: string, isSaving: boolean) => {
    setFlashcards((prev) =>
      prev.map((item) =>
        item.clientId === clientId ? { ...item, isSaving } : item,
      ),
    )
  }

  const setQuestionSaving = (clientId: string, isSaving: boolean) => {
    setQuestions((prev) =>
      prev.map((item) =>
        item.clientId === clientId ? { ...item, isSaving } : item,
      ),
    )
  }

  const saveFlashcardByKey = useCallback(
    async (clientId: string, options?: { silent?: boolean }) => {
      const card = flashcardsRef.current.find(
        (item) => item.clientId === clientId,
      )
      if (!card) return

      const front = card.front.trim()
      const back = card.back.trim()
      const fields = normalizeFieldsInput(card.fields) ?? {}

      if (!front || !back) {
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Missing fields",
            description: "Front and back are required.",
          })
        }
        return
      }

      setFlashcardSaving(clientId, true)

      try {
        if (card._id) {
          const res = await fetch(`/api/flashcards/${card._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              front,
              back,
              frontImage: card.frontImage,
              backImage: card.backImage,
              frontAudio: card.frontAudio,
              backAudio: card.backAudio,
              fields,
              tags: card.tags,
              order: typeof card.order === "number" ? card.order : undefined,
            }),
          })

          if (!res.ok) {
            const data = await res.json().catch(() => null)
            throw new Error(data?.error || "Update failed")
          }
        } else {
          const index = flashcardsRef.current.findIndex(
            (item) => item.clientId === clientId,
          )
          const res = await fetch("/api/flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deckId,
              front,
              back,
              frontImage: card.frontImage,
              backImage: card.backImage,
              frontAudio: card.frontAudio,
              backAudio: card.backAudio,
              fields,
              tags: card.tags,
              order:
                typeof card.order === "number" ? card.order : Math.max(0, index),
            }),
          })

          const data = await res.json().catch(() => null)
          if (!res.ok) {
            throw new Error(data?.error || "Create failed")
          }

          const newId = Array.isArray(data?.ids) ? data.ids[0] : undefined
          if (newId) {
            setFlashcards((prev) =>
              prev.map((item) =>
                item.clientId === clientId ? { ...item, _id: newId } : item,
              ),
            )
          }
        }

        clearFlashcardDirty(clientId)
        if (!options?.silent) {
          toast({
            title: "Saved",
            description: "Flashcard saved successfully.",
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Save failed"
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Save failed",
            description: message,
          })
        }
      } finally {
        setFlashcardSaving(clientId, false)
      }
    },
    [deckId, clearFlashcardDirty, toast],
  )

  const saveQuestionByKey = useCallback(
    async (clientId: string, options?: { silent?: boolean }) => {
      const question = questionsRef.current.find(
        (item) => item.clientId === clientId,
      )
      if (!question) return

      const textValue = question.question.trim()
      const choices = question.choices.map((choice) => ({
        ...choice,
        text: choice.text.trim(),
        image: choice.image?.trim() || undefined,
      }))

      if (!textValue) {
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Missing question",
            description: "Question text is required.",
          })
        }
        return
      }

      const validChoices = choices.filter((choice) => choice.text)
      if (validChoices.length < 2 || !validChoices.some((c) => c.isCorrect)) {
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Invalid choices",
            description: "Need at least 2 choices and 1 correct answer.",
          })
        }
        return
      }

      setQuestionSaving(clientId, true)

      try {
        if (question._id) {
          const res = await fetch(`/api/questions/${question._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: textValue,
              choices: validChoices,
              explanation: question.explanation?.trim(),
              image: question.image,
              tags: question.tags,
              order:
                typeof question.order === "number" ? question.order : undefined,
            }),
          })

          if (!res.ok) {
            const data = await res.json().catch(() => null)
            throw new Error(data?.error || "Update failed")
          }
        } else {
          const index = questionsRef.current.findIndex(
            (item) => item.clientId === clientId,
          )
          const res = await fetch("/api/questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              deckId,
              question: textValue,
              choices: validChoices,
              explanation: question.explanation?.trim(),
              image: question.image,
              tags: question.tags,
              order:
                typeof question.order === "number"
                  ? question.order
                  : Math.max(0, index),
            }),
          })

          const data = await res.json().catch(() => null)
          if (!res.ok) {
            throw new Error(data?.error || "Create failed")
          }

          const newId = Array.isArray(data?.ids) ? data.ids[0] : undefined
          if (newId) {
            setQuestions((prev) =>
              prev.map((item) =>
                item.clientId === clientId ? { ...item, _id: newId } : item,
              ),
            )
          }
        }

        clearQuestionDirty(clientId)
        if (!options?.silent) {
          toast({
            title: "Saved",
            description: "Question saved successfully.",
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Save failed"
        if (!options?.silent) {
          toast({
            variant: "destructive",
            title: "Save failed",
            description: message,
          })
        }
      } finally {
        setQuestionSaving(clientId, false)
      }
    },
    [deckId, clearQuestionDirty, toast],
  )

  const scheduleFlashcardAutosave = useCallback(
    (clientId: string) => {
      const existingTimer = flashAutosaveTimers.current[clientId]
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }

      flashAutosaveTimers.current[clientId] = window.setTimeout(() => {
        delete flashAutosaveTimers.current[clientId]
        void saveFlashcardByKey(clientId, { silent: true })
      }, AUTO_SAVE_MS)
    },
    [saveFlashcardByKey],
  )

  const scheduleQuestionAutosave = useCallback(
    (clientId: string) => {
      const existingTimer = questionAutosaveTimers.current[clientId]
      if (existingTimer) {
        window.clearTimeout(existingTimer)
      }

      questionAutosaveTimers.current[clientId] = window.setTimeout(() => {
        delete questionAutosaveTimers.current[clientId]
        void saveQuestionByKey(clientId, { silent: true })
      }, AUTO_SAVE_MS)
    },
    [saveQuestionByKey],
  )


  const persistFlashcardOrder = async (ordered: FlashcardItem[]) => {
    const updates = ordered
      .map((card, idx) =>
        card._id
          ? fetch(`/api/flashcards/${card._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order: idx }),
            })
          : null,
      )
      .filter(Boolean) as Promise<Response>[]

    if (updates.length === 0) return

    const results = await Promise.allSettled(updates)
    const failed = results.filter((result) =>
      result.status === "rejected"
        ? true
        : result.status === "fulfilled" && !result.value.ok,
    )

    if (failed.length > 0) {
      toast({
        variant: "destructive",
        title: "Lưu thứ tự thất bại",
        description: "Không thể lưu lại thứ tự thẻ. Vui lòng thử lại.",
      })
    }
  }

  const persistQuestionOrder = async (ordered: QuestionItem[]) => {
    const updates = ordered
      .map((question, idx) =>
        question._id
          ? fetch(`/api/questions/${question._id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order: idx }),
            })
          : null,
      )
      .filter(Boolean) as Promise<Response>[]

    if (updates.length === 0) return

    const results = await Promise.allSettled(updates)
    const failed = results.filter((result) =>
      result.status === "rejected"
        ? true
        : result.status === "fulfilled" && !result.value.ok,
    )

    if (failed.length > 0) {
      toast({
        variant: "destructive",
        title: "Lưu thứ tự thất bại",
        description: "Không thể lưu lại thứ tự câu hỏi. Vui lòng thử lại.",
      })
    }
  }

  const handleFlashcardDragStart = (
    event: DragEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(index))
    setDraggingFlashIndex(index)
  }

  const handleFlashcardDrop = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault()
    const fromIndexRaw = event.dataTransfer.getData("text/plain")
    const fromIndex =
      draggingFlashIndex ?? (fromIndexRaw ? Number(fromIndexRaw) : -1)

    setDraggingFlashIndex(null)

    if (
      fromIndex < 0 ||
      Number.isNaN(fromIndex) ||
      fromIndex === targetIndex
    ) {
      return
    }

    const next = [...flashcards]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(targetIndex, 0, moved)

    const nextWithOrder = next.map((card, idx) => ({
      ...card,
      order: idx,
    }))

    setFlashcards(nextWithOrder)
    void persistFlashcardOrder(nextWithOrder)
  }

  const handleFlashcardDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const updateFlashcard = (
    index: number,
    field: "front" | "back" | "frontImage" | "backImage" | "frontAudio" | "backAudio",
    value: string,
  ) => {
    setFlashcards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, [field]: value } : card)),
    )
    const key = flashcards[index]?.clientId
    if (key) {
      markFlashcardDirty(key)
      scheduleFlashcardAutosave(key)
    }
  }

  const updateFlashcardTags = (index: number, value: string) => {
    const nextTags = normalizeTagsInput(value)
    setFlashcards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, tags: nextTags } : card)),
    )
    const key = flashcards[index]?.clientId
    if (key) {
      markFlashcardDirty(key)
      scheduleFlashcardAutosave(key)
    }
  }

  const handleFieldAudioUpload = async (
    key: string,
    file: File | null,
    onUrl: (url: string) => void,
  ) => {
    if (!file) return

    try {
      setUploading((prev) => ({ ...prev, [key]: true }))
      const url = await uploadAudioFile(file)
      onUrl(url)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Audio upload failed"
      toast({
        variant: "destructive",
        title: "Upload error",
        description: message,
      })
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const updateFlashcardFields = (index: number, fields: FieldItem[]) => {
    setFlashcards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, fields } : card)),
    )
    const key = flashcards[index]?.clientId
    if (key) {
      markFlashcardDirty(key)
      scheduleFlashcardAutosave(key)
    }
  }

  const addFlashcardField = (index: number) => {
    const current = flashcards[index]?.fields ?? []
    updateFlashcardFields(index, [...current, { key: "", value: "" }])
  }

  const updateFlashcardFieldKey = (
    index: number,
    fieldIndex: number,
    value: string,
  ) => {
    const current = flashcards[index]?.fields ?? []
    const next = current.map((field, i) =>
      i === fieldIndex ? { ...field, key: value } : field,
    )
    updateFlashcardFields(index, next)
  }

  const updateFlashcardFieldValue = (
    index: number,
    fieldIndex: number,
    value: string,
  ) => {
    const current = flashcards[index]?.fields ?? []
    const next = current.map((field, i) =>
      i === fieldIndex ? { ...field, value } : field,
    )
    updateFlashcardFields(index, next)
  }

  const removeFlashcardField = (index: number, fieldIndex: number) => {
    const current = flashcards[index]?.fields ?? []
    const next = current.filter((_, i) => i !== fieldIndex)
    updateFlashcardFields(index, next)
  }

  const addFlashcard = () => {
    const newCard: FlashcardItem = {
      clientId: createClientId(),
      front: "",
      back: "",
      frontImage: "",
      backImage: "",
      frontAudio: "",
      backAudio: "",
      fields: [],
      tags: [],
      order: flashcards.length,
    }
    setFlashcards((prev) => [...prev, newCard])
    markFlashcardDirty(newCard.clientId)
  }

  const saveFlashcard = async (index: number) => {
    const card = flashcards[index]
    if (!card) return
    await saveFlashcardByKey(card.clientId)
  }

  const finalizeDelete = async (clientId: string) => {
    const pending = pendingDeletes.current[clientId]
    if (!pending) return
    delete pendingDeletes.current[clientId]

    const restoreFlashcard = () => {
      const card = pending.item as FlashcardItem
      setFlashcards((prev) => {
        if (prev.some((item) => item.clientId === clientId)) return prev
        const next = [...prev]
        const insertIndex = Math.min(Math.max(pending.index, 0), next.length)
        next.splice(insertIndex, 0, card)
        return next
      })
      if (pending.wasDirty) {
        markFlashcardDirty(clientId)
      }
    }

    const restoreQuestion = () => {
      const question = pending.item as QuestionItem
      setQuestions((prev) => {
        if (prev.some((item) => item.clientId === clientId)) return prev
        const next = [...prev]
        const insertIndex = Math.min(Math.max(pending.index, 0), next.length)
        next.splice(insertIndex, 0, question)
        return next
      })
      if (pending.wasDirty) {
        markQuestionDirty(clientId)
      }
    }

    try {
      if (pending.type === "flashcard") {
        const card = pending.item as FlashcardItem
        if (!card._id) return
        const res = await fetch(`/api/flashcards/${card._id}`, {
          method: "DELETE",
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || "Delete failed")
        }
      } else {
        const question = pending.item as QuestionItem
        if (!question._id) return
        const res = await fetch(`/api/questions/${question._id}`, {
          method: "DELETE",
        })
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || "Delete failed")
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Delete failed"
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: message,
      })
      if (pending.type === "flashcard") {
        restoreFlashcard()
      } else {
        restoreQuestion()
      }
    }
  }

  const undoDelete = (clientId: string) => {
    const pending = pendingDeletes.current[clientId]
    if (!pending) return

    window.clearTimeout(pending.timer)
    delete pendingDeletes.current[clientId]

    if (pending.type === "flashcard") {
      const card = pending.item as FlashcardItem
      setFlashcards((prev) => {
        if (prev.some((item) => item.clientId === clientId)) return prev
        const next = [...prev]
        const insertIndex = Math.min(Math.max(pending.index, 0), next.length)
        next.splice(insertIndex, 0, card)
        return next
      })
      if (pending.wasDirty) {
        markFlashcardDirty(clientId)
      }
      return
    }

    const question = pending.item as QuestionItem
    setQuestions((prev) => {
      if (prev.some((item) => item.clientId === clientId)) return prev
      const next = [...prev]
      const insertIndex = Math.min(Math.max(pending.index, 0), next.length)
      next.splice(insertIndex, 0, question)
      return next
    })
    if (pending.wasDirty) {
      markQuestionDirty(clientId)
    }
  }

  const deleteFlashcard = async (
    index: number,
    options?: { silent?: boolean },
  ) => {
    const card = flashcards[index]
    if (!card) return
    const clientId = card.clientId
    const wasDirty = dirtyFlashcards.has(clientId)

    if (flashAutosaveTimers.current[clientId]) {
      window.clearTimeout(flashAutosaveTimers.current[clientId])
      delete flashAutosaveTimers.current[clientId]
    }

    setFlashcards((prev) => prev.filter((_, i) => i !== index))
    clearFlashcardDirty(clientId)
    setSelectedFlashcards((prev) => {
      if (!prev.has(clientId)) return prev
      const next = new Set(prev)
      next.delete(clientId)
      return next
    })

    const timer = window.setTimeout(() => {
      void finalizeDelete(clientId)
    }, UNDO_TIMEOUT_MS)

    pendingDeletes.current[clientId] = {
      type: "flashcard",
      item: card,
      index,
      timer,
      wasDirty,
    }

    if (!options?.silent) {
      toast({
        title: "Đã xóa flashcard",
        description: "Bạn có thể hoàn tác trong vài giây.",
        action: (
          <ToastAction altText="Hoàn tác" onClick={() => undoDelete(clientId)}>
            Hoàn tác
          </ToastAction>
        ),
      })
    }
  }

  const handleQuestionDragStart = (
    event: DragEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", String(index))
    setDraggingQuestionIndex(index)
  }

  const handleQuestionDrop = (
    event: DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    event.preventDefault()
    const fromIndexRaw = event.dataTransfer.getData("text/plain")
    const fromIndex =
      draggingQuestionIndex ?? (fromIndexRaw ? Number(fromIndexRaw) : -1)

    setDraggingQuestionIndex(null)

    if (
      fromIndex < 0 ||
      Number.isNaN(fromIndex) ||
      fromIndex === targetIndex
    ) {
      return
    }

    const next = [...questions]
    const [moved] = next.splice(fromIndex, 1)
    if (!moved) return
    next.splice(targetIndex, 0, moved)

    const nextWithOrder = next.map((question, idx) => ({
      ...question,
      order: idx,
    }))

    setQuestions(nextWithOrder)
    void persistQuestionOrder(nextWithOrder)
  }

  const handleQuestionDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const updateQuestionField = (
    index: number,
    field: "question" | "explanation" | "image",
    value: string,
  ) => {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index ? { ...question, [field]: value } : question,
      ),
    )
    const key = questions[index]?.clientId
    if (key) {
      markQuestionDirty(key)
      scheduleQuestionAutosave(key)
    }
  }

  const updateQuestionTags = (index: number, value: string) => {
    const nextTags = normalizeTagsInput(value)
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index ? { ...question, tags: nextTags } : question,
      ),
    )
    const key = questions[index]?.clientId
    if (key) {
      markQuestionDirty(key)
      scheduleQuestionAutosave(key)
    }
  }

  const updateChoiceField = (
    questionIndex: number,
    choiceIndex: number,
    field: keyof ChoiceItem,
    value: string | boolean,
  ) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== questionIndex) return question
        const choices = question.choices.map((choice, ci) =>
          ci === choiceIndex ? { ...choice, [field]: value } : choice,
        )
        return { ...question, choices }
      }),
    )
    const key = questions[questionIndex]?.clientId
    if (key) {
      markQuestionDirty(key)
      scheduleQuestionAutosave(key)
    }
  }

  const setCorrectChoice = (questionIndex: number, choiceIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== questionIndex) return question
        const choices = question.choices.map((choice, ci) => ({
          ...choice,
          isCorrect: ci === choiceIndex,
        }))
        return { ...question, choices }
      }),
    )
    const key = questions[questionIndex]?.clientId
    if (key) {
      markQuestionDirty(key)
      scheduleQuestionAutosave(key)
    }
  }

  const addChoice = (questionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== questionIndex) return question
        return {
          ...question,
          choices: [...question.choices, { text: "", isCorrect: false, image: "" }],
        }
      }),
    )
    const key = questions[questionIndex]?.clientId
    if (key) {
      markQuestionDirty(key)
      scheduleQuestionAutosave(key)
    }
  }

  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== questionIndex) return question
        const choices = question.choices.filter((_, ci) => ci !== choiceIndex)
        return { ...question, choices }
      }),
    )
    const key = questions[questionIndex]?.clientId
    if (key) {
      markQuestionDirty(key)
      scheduleQuestionAutosave(key)
    }
  }

  const addQuestion = () => {
    const newQuestion: QuestionItem = {
      clientId: createClientId(),
      question: "",
      explanation: "",
      image: "",
      tags: [],
      order: questions.length,
      choices: [
        { text: "", isCorrect: true, image: "" },
        { text: "", isCorrect: false, image: "" },
        { text: "", isCorrect: false, image: "" },
        { text: "", isCorrect: false, image: "" },
      ],
    }
    setQuestions((prev) => [
      ...prev,
      newQuestion,
    ])
    markQuestionDirty(newQuestion.clientId)
  }

  const saveQuestion = async (index: number) => {
    const question = questions[index]
    if (!question) return
    await saveQuestionByKey(question.clientId)
  }

  const deleteQuestion = async (
    index: number,
    options?: { silent?: boolean },
  ) => {
    const question = questions[index]
    if (!question) return
    const clientId = question.clientId
    const wasDirty = dirtyQuestions.has(clientId)

    if (questionAutosaveTimers.current[clientId]) {
      window.clearTimeout(questionAutosaveTimers.current[clientId])
      delete questionAutosaveTimers.current[clientId]
    }

    setQuestions((prev) => prev.filter((_, i) => i !== index))
    clearQuestionDirty(clientId)
    setSelectedQuestions((prev) => {
      if (!prev.has(clientId)) return prev
      const next = new Set(prev)
      next.delete(clientId)
      return next
    })

    const timer = window.setTimeout(() => {
      void finalizeDelete(clientId)
    }, UNDO_TIMEOUT_MS)

    pendingDeletes.current[clientId] = {
      type: "question",
      item: question,
      index,
      timer,
      wasDirty,
    }

    if (!options?.silent) {
      toast({
        title: "Đã xóa câu hỏi",
        description: "Bạn có thể hoàn tác trong vài giây.",
        action: (
          <ToastAction altText="Hoàn tác" onClick={() => undoDelete(clientId)}>
            Hoàn tác
          </ToastAction>
        ),
      })
    }
  }

  const flashcardFilterTags = useMemo(
    () => normalizeTagsInput(flashcardTagFilter),
    [flashcardTagFilter],
  )

  const questionFilterTags = useMemo(
    () => normalizeTagsInput(questionTagFilter),
    [questionTagFilter],
  )

  const filteredFlashcards = useMemo(() => {
    const searchValue = normalizeSearch(flashcardSearch)
    return flashcards
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => {
        const matchesSearch =
          !searchValue ||
          card.front.toLowerCase().includes(searchValue) ||
          card.back.toLowerCase().includes(searchValue)
        const matchesTags =
          flashcardFilterTags.length === 0 ||
          flashcardFilterTags.every((tag) => card.tags.includes(tag))
        return matchesSearch && matchesTags
      })
  }, [flashcards, flashcardSearch, flashcardFilterTags])

  const filteredQuestions = useMemo(() => {
    const searchValue = normalizeSearch(questionSearch)
    return questions
      .map((question, index) => ({ question, index }))
      .filter(({ question }) => {
        const combinedText = [
          question.question,
          question.explanation ?? "",
          ...question.choices.map((choice) => choice.text),
        ]
          .join(" ")
          .toLowerCase()
        const matchesSearch =
          !searchValue || combinedText.includes(searchValue)
        const matchesTags =
          questionFilterTags.length === 0 ||
          questionFilterTags.every((tag) => question.tags.includes(tag))
        return matchesSearch && matchesTags
      })
  }, [questions, questionSearch, questionFilterTags])

  const toggleFlashcardSelect = (clientId: string) => {
    setSelectedFlashcards((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const toggleQuestionSelect = (clientId: string) => {
    setSelectedQuestions((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
      } else {
        next.add(clientId)
      }
      return next
    })
  }

  const selectAllFlashcards = () => {
    setSelectedFlashcards(
      new Set(filteredFlashcards.map((entry) => entry.card.clientId)),
    )
  }

  const clearFlashcardSelection = () => {
    setSelectedFlashcards(new Set())
  }

  const selectAllQuestions = () => {
    setSelectedQuestions(
      new Set(filteredQuestions.map((entry) => entry.question.clientId)),
    )
  }

  const clearQuestionSelection = () => {
    setSelectedQuestions(new Set())
  }

  const bulkAddFlashcardTags = () => {
    const tags = normalizeTagsInput(bulkFlashcardTags)
    if (tags.length === 0 || selectedFlashcards.size === 0) return

    setFlashcards((prev) =>
      prev.map((card) =>
        selectedFlashcards.has(card.clientId)
          ? { ...card, tags: mergeTags(card.tags, tags) }
          : card,
      ),
    )

    selectedFlashcards.forEach((clientId) => {
      markFlashcardDirty(clientId)
      scheduleFlashcardAutosave(clientId)
    })

    setBulkFlashcardTags("")
  }

  const bulkRemoveFlashcardTags = () => {
    const tags = normalizeTagsInput(bulkFlashcardRemoveTags)
    if (tags.length === 0 || selectedFlashcards.size === 0) return

    setFlashcards((prev) =>
      prev.map((card) =>
        selectedFlashcards.has(card.clientId)
          ? { ...card, tags: removeTags(card.tags, tags) }
          : card,
      ),
    )

    selectedFlashcards.forEach((clientId) => {
      markFlashcardDirty(clientId)
      scheduleFlashcardAutosave(clientId)
    })

    setBulkFlashcardRemoveTags("")
  }

  const bulkDeleteFlashcards = () => {
    if (selectedFlashcards.size === 0) return
    const ids = Array.from(selectedFlashcards)
    const indices = flashcards
      .map((card, idx) => (selectedFlashcards.has(card.clientId) ? idx : -1))
      .filter((idx) => idx >= 0)
      .sort((a, b) => b - a)
    indices.forEach((idx) => {
      void deleteFlashcard(idx, { silent: true })
    })
    clearFlashcardSelection()
    toast({
      title: `Đã xóa ${ids.length} flashcard`,
      description: "Bạn có thể hoàn tác trong vài giây.",
      action: (
        <ToastAction altText="Hoàn tác" onClick={() => ids.forEach(undoDelete)}>
          Hoàn tác
        </ToastAction>
      ),
    })
  }

  const bulkAddQuestionTags = () => {
    const tags = normalizeTagsInput(bulkQuestionTags)
    if (tags.length === 0 || selectedQuestions.size === 0) return

    setQuestions((prev) =>
      prev.map((question) =>
        selectedQuestions.has(question.clientId)
          ? { ...question, tags: mergeTags(question.tags, tags) }
          : question,
      ),
    )

    selectedQuestions.forEach((clientId) => {
      markQuestionDirty(clientId)
      scheduleQuestionAutosave(clientId)
    })

    setBulkQuestionTags("")
  }

  const bulkRemoveQuestionTags = () => {
    const tags = normalizeTagsInput(bulkQuestionRemoveTags)
    if (tags.length === 0 || selectedQuestions.size === 0) return

    setQuestions((prev) =>
      prev.map((question) =>
        selectedQuestions.has(question.clientId)
          ? { ...question, tags: removeTags(question.tags, tags) }
          : question,
      ),
    )

    selectedQuestions.forEach((clientId) => {
      markQuestionDirty(clientId)
      scheduleQuestionAutosave(clientId)
    })

    setBulkQuestionRemoveTags("")
  }

  const bulkDeleteQuestions = () => {
    if (selectedQuestions.size === 0) return
    const ids = Array.from(selectedQuestions)
    const indices = questions
      .map((question, idx) =>
        selectedQuestions.has(question.clientId) ? idx : -1,
      )
      .filter((idx) => idx >= 0)
      .sort((a, b) => b - a)
    indices.forEach((idx) => {
      void deleteQuestion(idx, { silent: true })
    })
    clearQuestionSelection()
    toast({
      title: `Đã xóa ${ids.length} câu hỏi`,
      description: "Bạn có thể hoàn tác trong vài giây.",
      action: (
        <ToastAction altText="Hoàn tác" onClick={() => ids.forEach(undoDelete)}>
          Hoàn tác
        </ToastAction>
      ),
    })
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 stagger">
        <p className="text-sm text-muted-foreground">Loading deck...</p>
      </main>
    )
  }

  if (!deck) {
    return (
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 stagger">
        <p className="text-sm text-muted-foreground">Deck not found.</p>
      </main>
    )
  }

  const decksHref = subject
    ? `/decks?subject=${encodeURIComponent(subject)}`
    : "/decks"
  const deckHref = subject
    ? `/decks/${deckId}?subject=${encodeURIComponent(subject)}`
    : `/decks/${deckId}`
  const flashcardsHref = `/decks/${deckId}/flashcards?mode=due${
    subject ? `&subject=${encodeURIComponent(subject)}` : ""
  }`
  const mcqHref = `/decks/${deckId}/mcq?mode=due${
    subject ? `&subject=${encodeURIComponent(subject)}` : ""
  }`

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 stagger">
      <nav className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link
          href={decksHref}
          className="hover:text-foreground"
          onClick={(event) => {
            if (!confirmLeave()) event.preventDefault()
          }}
        >
          Decks
        </Link>
        <span>/</span>
        <Link
          href={deckHref}
          className="hover:text-foreground"
          onClick={(event) => {
            if (!confirmLeave()) event.preventDefault()
          }}
        >
          {deckName}
        </Link>
        <span>/</span>
        <span className="text-foreground">Edit set</span>
      </nav>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!confirmLeave()) return
                router.push(deckHref)
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span>{deck.subject || "Deck"}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit set</h1>
          <p className="text-sm text-muted-foreground">
            {deckName} - {flashcardCount} flashcards - {questionCount} questions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={deckHref}
              onClick={(event) => {
                if (!confirmLeave()) event.preventDefault()
              }}
            >
              Tổng quan
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={flashcardsHref}
              onClick={(event) => {
                if (!confirmLeave()) event.preventDefault()
              }}
            >
              Study flashcards
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={mcqHref}
              onClick={(event) => {
                if (!confirmLeave()) event.preventDefault()
              }}
            >
              Practice MCQ
            </Link>
          </Button>
        </div>
      </header>

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Image upload helper</CardTitle>
          <CardDescription className="text-xs">
            Upload an image and copy the URL into image fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="file"
            accept="image/*"
            className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
            disabled={uploadingImage}
            onChange={(e) => handleGlobalImageUpload(e.target.files?.[0] ?? null)}
          />
          {uploadedImageUrl ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input value={uploadedImageUrl} readOnly />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyImageUrl}
              >
                Copy URL
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="flashcards" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="questions">MCQ</TabsTrigger>
        </TabsList>

        <TabsContent value="flashcards" className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Tìm thuật ngữ hoặc định nghĩa..."
                value={flashcardSearch}
                onChange={(e) => setFlashcardSearch(e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <Input
                placeholder="Lọc theo tag (vd: tim, giải phẫu)"
                value={flashcardTagFilter}
                onChange={(e) => setFlashcardTagFilter(e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={selectAllFlashcards}>
                Chọn tất cả
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearFlashcardSelection}>
                Bỏ chọn
              </Button>
            </div>

            {selectedFlashcards.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Đã chọn <strong className="text-foreground">{selectedFlashcards.size}</strong> thẻ
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Thêm tag (vd: tim, chức năng)"
                    value={bulkFlashcardTags}
                    onChange={(e) => setBulkFlashcardTags(e.target.value)}
                    className="h-8 w-56"
                  />
                  <Button type="button" size="sm" onClick={bulkAddFlashcardTags}>
                    Thêm tag
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Gỡ tag (vd: nhớ lâu)"
                    value={bulkFlashcardRemoveTags}
                    onChange={(e) => setBulkFlashcardRemoveTags(e.target.value)}
                    className="h-8 w-56"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={bulkRemoveFlashcardTags}
                  >
                    Gỡ tag
                  </Button>
                </div>
                <Button type="button" size="sm" variant="destructive" onClick={bulkDeleteFlashcards}>
                  Xóa đã chọn
                </Button>
              </div>
            )}
          </div>

          {filteredFlashcards.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {flashcards.length === 0
                  ? "Chưa có flashcard nào. Thêm thẻ phía dưới."
                  : "Không tìm thấy flashcard phù hợp bộ lọc."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFlashcards.map(({ card, index }) => {
                const cardKey = getFlashcardKey(card)
                const showImages = Boolean(openFlashcardImages[cardKey])
                const frontKey = `flash-${cardKey}-front`
                const backKey = `flash-${cardKey}-back`
                const frontAudioKey = `flash-${cardKey}-front-audio`
                const backAudioKey = `flash-${cardKey}-back-audio`

                return (
                  <div
                    key={cardKey}
                    className={cn(
                      "rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition",
                      draggingFlashIndex === index && "opacity-70",
                    )}
                    onDragOver={handleFlashcardDragOver}
                    onDrop={(event) => handleFlashcardDrop(event, index)}
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selectedFlashcards.has(cardKey)}
                          onChange={() => toggleFlashcardSelect(cardKey)}
                          aria-label="Chọn flashcard"
                        />
                        <span className="text-lg font-semibold text-foreground">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) =>
                            handleFlashcardDragStart(event, index)
                          }
                          onDragEnd={() => setDraggingFlashIndex(null)}
                          className="cursor-grab rounded-md p-1 text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
                          aria-label="Kéo để sắp xếp"
                          title="Kéo để sắp xếp"
                        >
                          <GripVertical className="h-4 w-4 opacity-70" />
                        </button>
                      </div>

                      <div className="grid flex-1 gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Thuật ngữ
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[70px]")}
                            value={card.front}
                            onChange={(e) => {
                              autoResizeTextarea(e.currentTarget)
                              updateFlashcard(index, "front", e.target.value)
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Định nghĩa
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[70px]")}
                            value={card.back}
                            onChange={(e) => {
                              autoResizeTextarea(e.currentTarget)
                              updateFlashcard(index, "back", e.target.value)
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => saveFlashcard(index)}
                          disabled={card.isSaving}
                        >
                          <Save className="h-4 w-4" />
                          Lưu
                        </Button>
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "border-dashed",
                          )}
                          onClick={() => toggleFlashcardImages(cardKey)}
                        >
                          <Image className="h-4 w-4" />
                          Media
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteFlashcard(index)}
                          disabled={card.isSaving}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Input
                        placeholder="Tags (vd: tim, giải phẫu)"
                        value={tagsToInput(card.tags)}
                        onChange={(e) => updateFlashcardTags(index, e.target.value)}
                        className="min-w-[220px] flex-1"
                      />
                      {card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                          {card.tags.map((tag) => (
                            <span
                              key={`${cardKey}-tag-${tag}`}
                              className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Trường bổ sung
                      </label>
                      {card.fields.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Chưa có trường nào. Bấm “Thêm trường” để tạo.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {card.fields.map((field, fieldIndex) => (
                            <div
                              key={`${cardKey}-field-${fieldIndex}`}
                              className="flex flex-wrap items-start gap-2"
                            >
                              <Input
                                placeholder="Tên trường (vd: term)"
                                value={field.key}
                                onChange={(event) =>
                                  updateFlashcardFieldKey(
                                    index,
                                    fieldIndex,
                                    event.target.value,
                                  )
                                }
                                className="min-w-[140px] flex-1"
                              />
                              <Input
                                placeholder="Nội dung trường"
                                value={field.value}
                                onChange={(event) =>
                                  updateFlashcardFieldValue(
                                    index,
                                    fieldIndex,
                                    event.target.value,
                                  )
                                }
                                className="min-w-[200px] flex-[2]"
                              />
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  removeFlashcardField(index, fieldIndex)
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addFlashcardField(index)}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Thêm trường
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          Dùng {"{{field:ten_truong}}"} trong nội dung để chèn.
                        </span>
                      </div>
                    </div>

                    {showImages && (
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Ảnh mặt trước
                          </p>
                          <div className="mt-2 flex flex-col gap-2">
                            {card.frontImage ? (
                              <img
                                src={card.frontImage}
                                alt="Front"
                                className="max-h-40 w-auto max-w-full rounded-lg border border-primary/30 object-contain"
                              />
                            ) : (
                              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
                                Chưa có ảnh
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "cursor-pointer",
                                )}
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.currentTarget.files?.[0] ?? null
                                    e.currentTarget.value = ""
                                    void handleFieldImageUpload(frontKey, file, (url) =>
                                      updateFlashcard(index, "frontImage", url),
                                    )
                                  }}
                                />
                                {isUploading(frontKey) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Image className="h-4 w-4" />
                                )}
                                Tải ảnh
                              </label>
                              {card.frontImage ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateFlashcard(index, "frontImage", "")}
                                >
                                  <X className="h-4 w-4" />
                                  Xóa
                                </Button>
                              ) : null}
                            </div>
                            <Input
                              placeholder="Dán URL ảnh (optional)"
                              value={card.frontImage || ""}
                              onChange={(e) =>
                                updateFlashcard(index, "frontImage", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Ảnh mặt sau
                          </p>
                          <div className="mt-2 flex flex-col gap-2">
                            {card.backImage ? (
                              <img
                                src={card.backImage}
                                alt="Back"
                                className="max-h-40 w-auto max-w-full rounded-lg border border-primary/30 object-contain"
                              />
                            ) : (
                              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
                                Chưa có ảnh
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "cursor-pointer",
                                )}
                              >
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.currentTarget.files?.[0] ?? null
                                    e.currentTarget.value = ""
                                    void handleFieldImageUpload(backKey, file, (url) =>
                                      updateFlashcard(index, "backImage", url),
                                    )
                                  }}
                                />
                                {isUploading(backKey) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Image className="h-4 w-4" />
                                )}
                                Tải ảnh
                              </label>
                              {card.backImage ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateFlashcard(index, "backImage", "")}
                                >
                                  <X className="h-4 w-4" />
                                  Xóa
                                </Button>
                              ) : null}
                            </div>
                            <Input
                              placeholder="Dán URL ảnh (optional)"
                              value={card.backImage || ""}
                              onChange={(e) =>
                                updateFlashcard(index, "backImage", e.target.value)
                              }
                            />
                          </div>
                        </div>


                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Âm thanh mặt trước
                          </p>
                          <div className="mt-2 flex flex-col gap-2">
                            {card.frontAudio ? (
                              <audio controls className="w-full">
                                <source src={card.frontAudio} />
                              </audio>
                            ) : (
                              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
                                Chưa có âm thanh
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "cursor-pointer",
                                )}
                              >
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.currentTarget.files?.[0] ?? null
                                    e.currentTarget.value = ""
                                    void handleFieldAudioUpload(frontAudioKey, file, (url) =>
                                      updateFlashcard(index, "frontAudio", url),
                                    )
                                  }}
                                />
                                {isUploading(frontAudioKey) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                                Tải âm thanh
                              </label>
                              {card.frontAudio ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateFlashcard(index, "frontAudio", "")}
                                >
                                  <X className="h-4 w-4" />
                                  Xóa
                                </Button>
                              ) : null}
                            </div>
                            <Input
                              placeholder="Dán URL âm thanh (optional)"
                              value={card.frontAudio || ""}
                              onChange={(e) =>
                                updateFlashcard(index, "frontAudio", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                          <p className="text-xs font-semibold text-muted-foreground">
                            Âm thanh mặt sau
                          </p>
                          <div className="mt-2 flex flex-col gap-2">
                            {card.backAudio ? (
                              <audio controls className="w-full">
                                <source src={card.backAudio} />
                              </audio>
                            ) : (
                              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
                                Chưa có âm thanh
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <label
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "cursor-pointer",
                                )}
                              >
                                <input
                                  type="file"
                                  accept="audio/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.currentTarget.files?.[0] ?? null
                                    e.currentTarget.value = ""
                                    void handleFieldAudioUpload(backAudioKey, file, (url) =>
                                      updateFlashcard(index, "backAudio", url),
                                    )
                                  }}
                                />
                                {isUploading(backAudioKey) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                                Tải âm thanh
                              </label>
                              {card.backAudio ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => updateFlashcard(index, "backAudio", "")}
                                >
                                  <X className="h-4 w-4" />
                                  Xóa
                                </Button>
                              ) : null}
                            </div>
                            <Input
                              placeholder="Dán URL âm thanh (optional)"
                              value={card.backAudio || ""}
                              onChange={(e) =>
                                updateFlashcard(index, "backAudio", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <Button type="button" variant="outline" onClick={addFlashcard}>
            <Plus className="mr-2 h-4 w-4" /> Thêm thẻ
          </Button>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Tìm trong câu hỏi, đáp án, giải thích..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <Input
                placeholder="Lọc theo tag (vd: hô hấp, nước)"
                value={questionTagFilter}
                onChange={(e) => setQuestionTagFilter(e.target.value)}
                className="min-w-[220px] flex-1"
              />
              <Button type="button" size="sm" variant="outline" onClick={selectAllQuestions}>
                Chọn tất cả
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={clearQuestionSelection}>
                Bỏ chọn
              </Button>
            </div>

            {selectedQuestions.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Đã chọn <strong className="text-foreground">{selectedQuestions.size}</strong> câu
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Thêm tag (vd: chưa nắm)"
                    value={bulkQuestionTags}
                    onChange={(e) => setBulkQuestionTags(e.target.value)}
                    className="h-8 w-56"
                  />
                  <Button type="button" size="sm" onClick={bulkAddQuestionTags}>
                    Thêm tag
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Gỡ tag (vd: đã thuộc)"
                    value={bulkQuestionRemoveTags}
                    onChange={(e) => setBulkQuestionRemoveTags(e.target.value)}
                    className="h-8 w-56"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={bulkRemoveQuestionTags}
                  >
                    Gỡ tag
                  </Button>
                </div>
                <Button type="button" size="sm" variant="destructive" onClick={bulkDeleteQuestions}>
                  Xóa đã chọn
                </Button>
              </div>
            )}
          </div>

          {filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {questions.length === 0
                  ? "Chưa có câu hỏi nào. Thêm câu mới phía dưới."
                  : "Không tìm thấy câu hỏi phù hợp bộ lọc."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredQuestions.map(({ question, index }) => {
                const questionKey = getQuestionKey(question)
                const showImages = Boolean(openQuestionImages[questionKey])
                const questionImageKey = `question-${questionKey}`

                return (
                  <div
                    key={questionKey}
                    className={cn(
                      "rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm transition",
                      draggingQuestionIndex === index && "opacity-70",
                    )}
                    onDragOver={handleQuestionDragOver}
                    onDrop={(event) => handleQuestionDrop(event, index)}
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selectedQuestions.has(questionKey)}
                          onChange={() => toggleQuestionSelect(questionKey)}
                          aria-label="Chọn câu hỏi"
                        />
                        <span className="text-lg font-semibold text-foreground">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) =>
                            handleQuestionDragStart(event, index)
                          }
                          onDragEnd={() => setDraggingQuestionIndex(null)}
                          className="cursor-grab rounded-md p-1 text-muted-foreground transition hover:text-foreground active:cursor-grabbing"
                          aria-label="Kéo để sắp xếp"
                          title="Kéo để sắp xếp"
                        >
                          <GripVertical className="h-4 w-4 opacity-70" />
                        </button>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-start gap-4">
                          <div className="min-w-0 flex-1 space-y-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Câu hỏi
                            </label>
                            <textarea
                              className={cn(textareaBase, "min-h-[80px]")}
                              value={question.question}
                              onChange={(e) => {
                                autoResizeTextarea(e.currentTarget)
                                updateQuestionField(index, "question", e.target.value)
                              }}
                              ref={(el) => autoResizeTextarea(el)}
                            />
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => saveQuestion(index)}
                              disabled={question.isSaving}
                            >
                              <Save className="h-4 w-4" />
                              Lưu
                            </Button>
                            <button
                              type="button"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "border-dashed",
                              )}
                              onClick={() => toggleQuestionImages(questionKey)}
                            >
                              <Image className="h-4 w-4" />
                              Hình ảnh
                            </button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteQuestion(index)}
                              disabled={question.isSaving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            placeholder="Tags (vd: dược lý, sinh lý)"
                            value={tagsToInput(question.tags)}
                            onChange={(e) => updateQuestionTags(index, e.target.value)}
                            className="min-w-[220px] flex-1"
                          />
                          {question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                              {question.tags.map((tag) => (
                                <span
                                  key={`${questionKey}-tag-${tag}`}
                                  className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {showImages && (
                          <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-3">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Ảnh câu hỏi
                            </p>
                            <div className="mt-2 flex flex-col gap-2">
                              {question.image ? (
                                <img
                                  src={question.image}
                                  alt="Question"
                                  className="max-h-48 w-auto max-w-full rounded-lg border border-primary/30 object-contain"
                                />
                              ) : (
                                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border/70 text-xs text-muted-foreground">
                                  Chưa có ảnh
                                </div>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <label
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "cursor-pointer",
                                  )}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.currentTarget.files?.[0] ?? null
                                      e.currentTarget.value = ""
                                      void handleFieldImageUpload(
                                        questionImageKey,
                                        file,
                                        (url) => updateQuestionField(index, "image", url),
                                      )
                                    }}
                                  />
                                  {isUploading(questionImageKey) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Image className="h-4 w-4" />
                                  )}
                                  Tải ảnh
                                </label>
                                {question.image ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => updateQuestionField(index, "image", "")}
                                  >
                                    <X className="h-4 w-4" />
                                    Xóa
                                  </Button>
                                ) : null}
                              </div>
                              <Input
                                placeholder="Dán URL ảnh (optional)"
                                value={question.image || ""}
                                onChange={(e) =>
                                  updateQuestionField(index, "image", e.target.value)
                                }
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Đáp án
                          </label>
                          <div className="space-y-3">
                            {question.choices.map((choice, choiceIndex) => {
                              const choiceKey = `choice-${questionKey}-${choiceIndex}`

                              return (
                                <div
                                  key={choiceKey}
                                  className="rounded-xl border border-border/70 bg-muted/30 p-3"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 text-xs font-semibold text-muted-foreground">
                                      {String.fromCharCode(65 + choiceIndex)}
                                    </span>
                                    <Input
                                      className="flex-1"
                                      placeholder={`Đáp án ${choiceIndex + 1}`}
                                      value={choice.text}
                                      onChange={(e) =>
                                        updateChoiceField(
                                          index,
                                          choiceIndex,
                                          "text",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={choice.isCorrect ? "default" : "outline"}
                                      onClick={() => setCorrectChoice(index, choiceIndex)}
                                    >
                                      {choice.isCorrect ? "Đúng" : "Đánh dấu đúng"}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeChoice(index, choiceIndex)}
                                      disabled={question.choices.length <= 2}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <label
                                      className={cn(
                                        buttonVariants({ variant: "outline", size: "sm" }),
                                        "cursor-pointer",
                                      )}
                                    >
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.currentTarget.files?.[0] ?? null
                                          e.currentTarget.value = ""
                                          void handleFieldImageUpload(
                                            choiceKey,
                                            file,
                                            (url) =>
                                              updateChoiceField(
                                                index,
                                                choiceIndex,
                                                "image",
                                                url,
                                              ),
                                          )
                                        }}
                                      />
                                      {isUploading(choiceKey) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Image className="h-4 w-4" />
                                      )}
                                      Ảnh
                                    </label>
                                    <Input
                                      className="min-w-[220px] flex-1"
                                      placeholder="Dán URL ảnh (optional)"
                                      value={choice.image || ""}
                                      onChange={(e) =>
                                        updateChoiceField(
                                          index,
                                          choiceIndex,
                                          "image",
                                          e.target.value,
                                        )
                                      }
                                    />
                                    {choice.image ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          updateChoiceField(
                                            index,
                                            choiceIndex,
                                            "image",
                                            "",
                                          )
                                        }
                                      >
                                        <X className="h-4 w-4" />
                                        Xóa
                                      </Button>
                                    ) : null}
                                  </div>

                                  {choice.image ? (
                                    <img
                                      src={choice.image}
                                      alt={`Choice ${choiceIndex + 1}`}
                                      className="mt-2 max-h-32 w-auto max-w-full rounded-lg border border-primary/30 object-contain"
                                    />
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => addChoice(index)}
                          >
                            <Plus className="mr-2 h-4 w-4" /> Thêm đáp án
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Giải thích
                          </label>
                          <textarea
                            className={cn(textareaBase, "min-h-[80px]")}
                            value={question.explanation || ""}
                            onChange={(e) => {
                              autoResizeTextarea(e.currentTarget)
                              updateQuestionField(index, "explanation", e.target.value)
                            }}
                            ref={(el) => autoResizeTextarea(el)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="mr-2 h-4 w-4" /> Thêm câu hỏi
          </Button>
        </TabsContent>
      </Tabs>
    </main>
  )
}
