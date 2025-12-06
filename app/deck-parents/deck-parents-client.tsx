// app/deck-parents/deck-parents-client.tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Layers, Search, SortAsc } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

import type { ParentInfo } from "./page"

interface DeckParentsClientProps {
  parents: ParentInfo[]
}

type SortBy = "name" | "count"

export function DeckParentsClient({ parents }: DeckParentsClientProps) {
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("name")

  const totalDecks = useMemo(
    () => parents.reduce((sum, p) => sum + (p.deckCount ?? 0), 0),
    [parents],
  )

  const filteredParents = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = parents

    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q),
      )
    }

    const copied = [...list]

    copied.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, "vi")
      }
      // sortBy === "count"
      return (b.deckCount ?? 0) - (a.deckCount ?? 0)
    })

    return copied
  }, [parents, query, sortBy])

  const hasFilter = query.trim().length > 0

  return (
    <main className="container max-w-5xl mx-auto py-8 space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Layers className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] text-muted-foreground">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <Layers className="h-3 w-3" />
              </span>
              <span>Môn học / Chủ đề</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Chọn môn để xem bộ thẻ
            </h1>
            <p className="text-sm text-muted-foreground">
              Có{" "}
              <span className="font-medium text-emerald-400">
                {parents.length}
              </span>{" "}
              môn học với tổng cộng{" "}
              <span className="font-medium text-emerald-400">
                {totalDecks}
              </span>{" "}
              bộ thẻ. Nhấn vào một môn để xem các deck bên trong.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/decks">Xem tất cả bộ thẻ</Link>
        </Button>
      </section>

      {/* Thanh search + sort */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm môn: Nội tim, Tiếng anh, Ngoại tiêu hóa..."
              className="pl-9 text-sm"
            />
          </div>
          {hasFilter && (
            <p className="mt-1 text-xs text-muted-foreground">
              Đang lọc theo: <span className="font-medium">{query}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="hidden text-muted-foreground md:inline-flex">
            Sắp xếp:
          </span>
          <div className="inline-flex rounded-md border border-border/80 bg-background/60 p-1">
            <Button
              type="button"
              size="sm"
              variant={sortBy === "name" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setSortBy("name")}
            >
              <SortAsc className="mr-1 h-3 w-3" />
              Tên
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortBy === "count" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setSortBy("count")}
            >
              <SortAsc className="mr-1 h-3 w-3 rotate-90" />
              Số bộ thẻ
            </Button>
          </div>
        </div>
      </section>

      {/* Danh sách parent */}
      {filteredParents.length === 0 ? (
        <section className="flex h-[40vh] flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            {parents.length === 0
              ? "Hiện chưa có môn học nào. Hãy tạo deck với trường subject để bắt đầu."
              : "Không tìm thấy môn học phù hợp với từ khoá tìm kiếm."}
          </p>
          {hasFilter && (
            <Button size="sm" variant="outline" onClick={() => setQuery("")}>
              Xoá bộ lọc
            </Button>
          )}
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredParents.map((parent, index) => (
            <motion.div
              key={parent.name}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18, delay: index * 0.03 }}
            >
              <Link
                href={`/decks?subject=${encodeURIComponent(parent.name)}`}
                className="group block h-full"
              >
                <Card className="flex h-full flex-col border-border/70 bg-card/80 transition-colors group-hover:border-emerald-500/70 group-hover:bg-card/95">
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-base font-semibold">
                      {parent.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs text-muted-foreground">
                      {parent.deckCount} bộ thẻ trong môn này
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pt-1">
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
                      <Layers className="h-3 w-3" />
                      <span>Nhấn để xem deck</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </section>
      )}
    </main>
  )
}
