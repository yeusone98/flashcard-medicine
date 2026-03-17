// app/explore/explore-client.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  BookOpen,
  Globe,
  ListChecks,
  Search,
  Users,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface ExploreDeck {
  id: string
  name: string
  description: string
  subject: string
  shareToken: string
  flashcardCount: number
  questionCount: number
  ownerName: string
  updatedAt: string
}

interface ExploreResponse {
  decks: ExploreDeck[]
  total: number
  page: number
  limit: number
  subjects: string[]
}

export default function ExploreClient() {
  const { toast } = useToast()
  const [decks, setDecks] = useState<ExploreDeck[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedSubject, setSelectedSubject] = useState("")
  const [page, setPage] = useState(1)

  const fetchDecks = useCallback(async (q: string, subject: string, p: number) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (q) params.set("search", q)
      if (subject) params.set("subject", subject)
      params.set("page", String(p))
      params.set("limit", "24")

      const res = await fetch(`/api/explore?${params}`)
      if (!res.ok) throw new Error("Không thể tải danh sách")
      const data: ExploreResponse = await res.json()
      setDecks(data.decks)
      setTotal(data.total)
      setSubjects(data.subjects ?? [])
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Lỗi tải dữ liệu",
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchDecks(search, selectedSubject, page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    void fetchDecks(search, selectedSubject, 1)
  }

  function handleSubject(s: string) {
    const next = s === selectedSubject ? "" : s
    setSelectedSubject(next)
    setPage(1)
    void fetchDecks(search, next, 1)
  }

  const LIMIT = 24
  const totalPages = Math.ceil(total / LIMIT)

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col gap-6 px-4 py-6 stagger">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Khám phá Deck công khai</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Tìm và clone bộ thẻ flashcard y học từ cộng đồng.
        </p>
      </header>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm theo tên deck..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" size="sm">Tìm</Button>
      </form>

      {/* Subject filters */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-xs text-muted-foreground">Lọc môn:</span>
          {subjects.map((s) => (
            <Badge
              key={s}
              variant={selectedSubject === s ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => handleSubject(s)}
            >
              {s}
            </Badge>
          ))}
          {selectedSubject && (
            <Badge
              variant="secondary"
              className="cursor-pointer text-xs"
              onClick={() => handleSubject("")}
            >
              Xoá lọc ✕
            </Badge>
          )}
        </div>
      )}

      {/* Results */}
      <section>
        <p className="mb-3 text-xs text-muted-foreground">
          {loading ? "Đang tải..." : `${total} deck công khai`}
        </p>

        {!loading && decks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Không tìm thấy deck nào.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <Card key={deck.id} className="flex flex-col border-border/70 transition-shadow hover:shadow-md">
                <CardHeader className="flex-1 pb-2">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    {deck.subject && (
                      <Badge variant="secondary" className="text-[10px]">
                        {deck.subject}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="line-clamp-2 text-base leading-snug">
                    {deck.name}
                  </CardTitle>
                  {deck.description && (
                    <CardDescription className="line-clamp-2 text-xs">
                      {deck.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {deck.flashcardCount} thẻ
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3 w-3" />
                      {deck.questionCount} MCQ
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {deck.ownerName}
                    </span>
                  </div>
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/shared/${deck.shareToken}`}>Xem & Clone</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Trước
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Tiếp →
          </Button>
        </div>
      )}
    </main>
  )
}
