// app/import/cloze/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

export default function ImportClozePage() {
  const [file, setFile] = useState<File | null>(null)
  const [deckName, setDeckName] = useState("")
  const [deckDescription, setDeckDescription] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file || !deckName.trim()) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên deck và chọn file.",
      })
      return
    }

    try {
      setLoading(true)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("deckName", deckName.trim())

      const res = await fetch("/api/import/cloze", {
        method: "POST",
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || "Import thất bại")
      }

      // Reset form
      setDeckName("")
      setFile(null)

      // ✅ Popup import thành công
      toast({
        title: "Import thành công",
        description: `Deck "${deckName}" đã được tạo/import thành công.`,
      })
    } catch (error: any) {
      console.error(error)

      // ❌ Popup lỗi
      toast({
        variant: "destructive",
        title: "Import thất bại",
        description: error.message || "Vui lòng thử lại sau.",
      })
    } finally {
      setLoading(false)
    }
  }


  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href="/import">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">
          Import Cloze Flashcards (.docx)
        </h1>
      </div>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-base">Import Cloze</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            File .docx định dạng Cloze sẽ được chuyển thành flashcard và deck
            mới.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tên deck</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="VD: Sinh lý – Huyết áp (Cloze)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Mô tả deck</label>
              <textarea
                className="h-20 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={deckDescription}
                onChange={(e) => setDeckDescription(e.target.value)}
                placeholder="VD: Bộ thẻ Cloze ôn tập huyết áp, sinh lý tim mạch..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">File .docx</label>
              <input
                type="file"
                accept=".docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:file:bg-primary/20"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !file}
            >
              {loading ? "Đang import..." : "Import Cloze"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          {message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </CardFooter>
      </Card>
    </main>
  )
}
