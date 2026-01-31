// app/import/manual-json/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Code2, Layers } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

interface ManualImportPayload {
  deckId?: string
  deckName?: string
  description?: string
  subject?: string
  flashcards?: unknown
  questions?: unknown
  [key: string]: unknown
}

type ImportResponse =
  | {
      flashcardCount?: number
      questionCount?: number
      deckId?: string
      deckName?: string
      mode?: "new" | "append"
      error?: string
    }
  | null

// Giá trị đặc biệt cho Select
const NONE_VALUE = "__NONE__"
const NEW_VALUE = "__NEW__"
const NEW_DECK_VALUE = "__NEW_DECK__"

export default function ImportManualJsonPage() {
  const [deckName, setDeckName] = useState("")
  const [description, setDescription] = useState("")
  const [jsonText, setJsonText] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // deck target
  const [deckOptions, setDeckOptions] = useState<{ id: string; name: string }[]>([])
  const [deckValue, setDeckValue] = useState<string>(NEW_DECK_VALUE)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState("")

  // parent deck / subject
  const [parentOptions, setParentOptions] = useState<string[]>([])
  const [parentValue, setParentValue] = useState<string>(NONE_VALUE)
  const [newParent, setNewParent] = useState<string>("")

  const { toast } = useToast()

  // Lấy danh sách môn học (subject) từ API
  useEffect(() => {
    let cancelled = false

    const fetchParents = async () => {
      try {
        const res = await fetch("/api/deck-parents")
        if (!res.ok) return

        const data = (await res.json()) as { parents?: unknown }

        if (cancelled) return

        if (Array.isArray(data.parents)) {
          const parents = data.parents
            .filter(
              (p): p is string =>
                typeof p === "string" && p.trim().length > 0,
            )
            .map((p) => p.trim())
            .sort((a, b) => a.localeCompare(b, "vi"))

          setParentOptions(parents)
        }
      } catch (error) {
        if (cancelled) return
        console.error("Lỗi gọi /api/deck-parents", error)
      }
    }

    void fetchParents()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const fetchDecks = async () => {
      try {
        const res = await fetch("/api/decks")
        if (!res.ok) return

        const data = (await res.json()) as unknown

        if (cancelled) return

        if (Array.isArray(data)) {
          const decks = data
            .map((d) => ({
              id: typeof d?._id === "string" ? d._id : "",
              name: typeof d?.name === "string" ? d.name : "Untitled deck",
            }))
            .filter((d) => d.id)
            .sort((a, b) => a.name.localeCompare(b.name, "vi"))

          setDeckOptions(decks)
        }
      } catch (error) {
        if (cancelled) return
        console.error("Error calling /api/decks", error)
      }
    }

    void fetchDecks()

    return () => {
      cancelled = true
    }
  }, [])

  const hasParentOptions = useMemo(
    () => parentOptions.length > 0,
    [parentOptions],
  )

  const hasDeckOptions = useMemo(
    () => deckOptions.length > 0,
    [deckOptions],
  )

  const isAppending = deckValue !== NEW_DECK_VALUE

  const selectedDeck = useMemo(
    () => deckOptions.find((deck) => deck.id === deckValue),
    [deckOptions, deckValue],
  )

  const handleImageUpload = async (file: File | null) => {
    if (!file) return

    try {
      setUploadingImage(true)
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

      setUploadedImageUrl(url)
      toast({
        title: "Image uploaded",
        description: "Copy the URL and paste into JSON fields.",
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // 1. Parse JSON
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      const desc = "JSON không hợp lệ. Vui lòng kiểm tra lại cú pháp."
      setMessage(desc)
      toast({
        variant: "destructive",
        title: "Lỗi JSON",
        description: desc,
      })
      return
    }

    // 2. Chuẩn hoá payload
    let payload: ManualImportPayload

    if (Array.isArray(parsed)) {
      // Người dùng chỉ dán mảng flashcards
      payload = { flashcards: parsed }
    } else if (parsed && typeof parsed === "object") {
      payload = { ...(parsed as ManualImportPayload) }
    } else {
      const desc =
        "JSON phải là object (chứa flashcards/questions) hoặc mảng flashcards."
      setMessage(desc)
      toast({
        variant: "destructive",
        title: "Format JSON không đúng",
        description: desc,
      })
      return
    }

    const deckNameTrimmed = deckName.trim()
    const descriptionTrimmed = description.trim()

    let finalDeckName = ""
    let finalSubject = ""

    if (!isAppending) {
      delete payload.deckId
      if (deckNameTrimmed) {
        payload.deckName = deckNameTrimmed
      }
      if (descriptionTrimmed) {
        payload.description = descriptionTrimmed
      }

      finalDeckName =
        typeof payload.deckName === "string"
          ? payload.deckName.toString().trim()
          : ""

      if (!finalDeckName) {
        const desc =
          "Missing deckName. Enter 'Deck name' above or add deckName in JSON."
        setMessage(desc)
        toast({
          variant: "destructive",
          title: "Missing deck name",
          description: desc,
        })
        return
      }

      payload.deckName = finalDeckName

      // 3. Handle subject (optional)

      if (parentValue === NEW_VALUE) {
        const trimmed = newParent.trim()
        if (!trimmed) {
          const desc =
            "You chose to create a new subject but did not enter a name."
          setMessage(desc)
          toast({
            variant: "destructive",
            title: "Missing subject name",
            description: desc,
          })
          return
        }
        finalSubject = trimmed
      } else if (parentValue && parentValue !== NONE_VALUE) {
        finalSubject = parentValue
      } else if (typeof payload.subject === "string") {
        finalSubject = payload.subject.toString().trim()
      }

      if (finalSubject) {
        payload.subject = finalSubject
      } else {
        payload.subject = undefined
      }
    } else {
      payload.deckId = deckValue
      finalDeckName = selectedDeck?.name ?? ""
      delete payload.deckName
      delete payload.description
      delete payload.subject
    }

    try {
      setLoading(true)
      setMessage(null)

      const res = await fetch("/api/import/manual-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = (await res.json().catch(() => null)) as ImportResponse

      if (!res.ok) {
        throw new Error(data?.error || "Import thất bại")
      }

      const flashcardCount = data?.flashcardCount ?? 0
      const questionCount = data?.questionCount ?? 0
      const mode = data?.mode ?? (isAppending ? "append" : "new")
      const deckLabel = data?.deckName || finalDeckName || selectedDeck?.name || "Deck"

      const desc =
        mode === "append"
          ? `Added ${flashcardCount} flashcards and ${questionCount} questions to "${deckLabel}".`
          : `Created deck "${deckLabel}" with ${flashcardCount} flashcards and ${questionCount} questions.`

      setJsonText("")
      if (!isAppending) {
        delete payload.deckId
        setDeckName("")
        setDescription("")
      }
      setMessage(desc)

      if (
        mode === "new" &&
        typeof data?.deckId === "string" &&
        typeof data?.deckName === "string"
      ) {
        const newDeckId = data.deckId
        const newDeckName = data.deckName
        setDeckOptions((prev) => {
          if (prev.some((deck) => deck.id === newDeckId)) return prev
          const next = [...prev, { id: newDeckId, name: newDeckName }]
          next.sort((a, b) => a.name.localeCompare(b.name, "vi"))
          return next
        })
      }

      if (mode === "new") {
        if (finalSubject) {
          setParentOptions((prev) => {
            if (prev.includes(finalSubject)) return prev
            const next = [...prev, finalSubject]
            next.sort((a, b) => a.localeCompare(b, "vi"))
            return next
          })
          setParentValue(finalSubject)
          setNewParent("")
        } else {
          setParentValue(NONE_VALUE)
          setNewParent("")
        }
      }

      toast({
        title: "Import JSON successful",
        description: desc,
      })

    } catch (error) {
      console.error(error)

      let desc = "Đã xảy ra lỗi, vui lòng thử lại."
      if (error instanceof Error) {
        desc = error.message
      }

      setMessage(desc)
      toast({
        variant: "destructive",
        title: "Import thất bại",
        description: desc,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col gap-4 px-4 py-6 stagger">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="-ml-2">
          <Link href="/import">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">
            Import manual từ JSON
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">
            Dán JSON flashcard / câu hỏi trắc nghiệm, chọn môn học, hệ thống
            sẽ tạo deck mới cho bạn.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Nội dung deck & JSON
          </CardTitle>
          <CardDescription className="space-y-1 text-xs md:text-sm">
            <p>
              Có thể để <code>deckName</code>, <code>description</code>,{" "}
              <code>subject</code> trong JSON, nhưng nếu nhập ở form bên dưới
              thì hệ thống sẽ ưu tiên dùng giá trị ở form.
            </p>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Target deck */}
          <div className="space-y-1">
            <label
              htmlFor="targetDeck"
              className="text-sm font-medium leading-none"
            >
              Target deck
            </label>

            <Select
              value={deckValue}
              onValueChange={(value) => setDeckValue(value)}
              disabled={loading}
            >
              <SelectTrigger id="targetDeck" className="w-full">
                <SelectValue
                  placeholder={
                    hasDeckOptions
                      ? "Create new deck"
                      : "Create new deck"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_DECK_VALUE}>Create new deck</SelectItem>
                {deckOptions.map((deck) => (
                  <SelectItem key={deck.id} value={deck.id}>
                    {deck.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isAppending ? (
              <p className="text-xs text-muted-foreground">
                Adding to: {selectedDeck?.name ?? "Unknown deck"}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                A new deck will be created from the JSON below.
              </p>
            )}
          </div>

          {/* Tên deck */}
          <div className="space-y-1">
            <label
              htmlFor="deckName"
              className="text-sm font-medium leading-none"
            >
              Tên deck <span className="text-destructive">*</span>
            </label>
            <Input
              id="deckName"
              placeholder='VD: "Theo dõi kiểm báo trong mổ – 5 yếu tố cơ bản"'
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              disabled={loading || isAppending}
            />
          </div>

          {/* Mô tả deck */}
          <div className="space-y-1">
            <label
              htmlFor="deckDescription"
              className="text-sm font-medium leading-none"
            >
              Mô tả deck (optional)
            </label>
            <textarea
              id="deckDescription"
              rows={2}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-0 focus-visible:border-primary"
              placeholder='VD: "Ôn tập 5 yếu tố theo dõi cơ bản trong mổ: nhiệt độ, SpO2, EtCO2, ECG và huyết áp động mạch..."'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || isAppending}
            />
          </div>

          {/* Môn học / parent deck - dùng Select shadcn */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium leading-none">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Môn học / Parent deck (optional)
            </label>

            <Select
              value={parentValue}
              onValueChange={(value) => setParentValue(value)}
              disabled={loading || isAppending}
            >
              <SelectTrigger id="parent" className="w-full">
                <SelectValue
                  placeholder={
                    hasParentOptions
                      ? "Không chọn (deck lẻ, không thuộc môn nào)"
                      : "Chưa có môn học nào"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  Không chọn (deck lẻ, không thuộc môn nào)
                </SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_VALUE}>+ Tạo môn học mới…</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-xs text-muted-foreground">
              Môn học dùng để nhóm deck ở trang <b>Môn học</b> (deck-parents).
              Ví dụ: <i>Nội tim, Tiếng anh…</i>
            </p>
          </div>

          {parentValue === NEW_VALUE && (
            <div className="space-y-1">
              <label
                htmlFor="newParent"
                className="text-sm font-medium leading-none"
              >
                Tên môn học mới
              </label>
              <Input
                id="newParent"
                placeholder='VD: "Nội tim", "Ngoại tiêu hoá", "TOEIC Listening"...'
                value={newParent}
                onChange={(e) => setNewParent(e.target.value)}
                disabled={loading || isAppending}
              />
            </div>
          )}

          {/* Image upload helper */}
          <div className="space-y-2 rounded-md border border-dashed border-border/70 bg-background/40 p-3">
            <p className="text-sm font-medium">Image upload helper</p>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
              disabled={uploadingImage}
              onChange={(e) => handleImageUpload(e.target.files?.[0] ?? null)}
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
            <p className="text-xs text-muted-foreground">
              Paste the URL into <code>frontImage</code>, <code>backImage</code>,
              <code>image</code> (question), or <code>choices[].image</code> fields.
            </p>
          </div>

          {/* JSON + submit */}
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label
                htmlFor="json"
                className="text-sm font-medium leading-none"
              >
                JSON nội dung deck
              </label>
              <textarea
                id="json"
                className="mt-1 h-80 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none ring-0 focus-visible:border-primary"
                placeholder={`{
  "deckName": "Cardiology basics",
  "description": "Ôn tập tim mạch",
  "subject": "Nội tim mạch",
  "flashcards": [
    {
      "front": "Định nghĩa suy tim?",
      "back": "Suy tim là...",
      "frontImage": "https://.../front.png",
      "backImage": "https://.../back.png"
    },
    { "front": "Có mấy độ NYHA?", "back": "4 độ: I, II, III, IV" }
  ],
  "questions": [
    {
      "question": "SpO2 bình thường khoảng bao nhiêu?",
      "image": "https://.../question.png",
      "choices": [
        { "text": "95-100%", "isCorrect": true, "image": "https://..." },
        { "text": "80-85%", "isCorrect": false }
      ],
      "explanation": "Normal SpO2 is 95-100%."
    }
  ]
}`}
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Có thể chỉ cần <code>flashcards</code> hoặc chỉ{" "}
                <code>questions</code>. Các field khác là optional.
              </p>
            </div>

            <Button type="submit" disabled={loading || !jsonText.trim()}>
              {loading ? "Đang import..." : "Import JSON"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {message && (
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {message}
            </p>
          )}

          {/* Hướng dẫn nhanh format JSON */}
          <div className="mt-2 w-full space-y-2 rounded-md border border-dashed border-border/70 bg-background/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">
              Gợi ý format JSON:
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                Root is an <code>object</code> and may include <code>deckName</code>,
                <code>description</code>, <code>subject</code>, <code>flashcards</code>,
                <code>questions</code>.
              </li>
              <li>
                Each <code>flashcard</code> has <code>front</code> and <code>back</code>,
                optional <code>frontImage</code>/<code>backImage</code> (URL).
              </li>
              <li>
                Each <code>question</code> has <code>question</code>, an array of
                <code>choices</code> (&gt;= 2, at least one <code>isCorrect: true</code>),
                optional <code>image</code>, <code>choices[].image</code>, and
                <code>explanation</code>.
              </li>
            </ul>
          </div>
        </CardFooter>
      </Card>
    </main>
  )
}
