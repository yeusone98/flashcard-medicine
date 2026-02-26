// app/deck-parents/deck-parents-client.tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Layers, Plus, Search, SortAsc } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

import type { ParentInfo } from "./page"

interface DeckParentsClientProps {
  parents: ParentInfo[]
}

type SortBy = "name" | "count"

export function DeckParentsClient({ parents }: DeckParentsClientProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<ParentInfo[]>(parents)
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [newSubject, setNewSubject] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const totalDecks = useMemo(
    () => items.reduce((sum, p) => sum + (p.deckCount ?? 0), 0),
    [items],
  )

  const filteredParents = useMemo(() => {
    const q = query.trim().toLowerCase()

    let list = items

    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q))
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
  }, [items, query, sortBy])

  const hasFilter = query.trim().length > 0

  const handleCreate = async () => {
    const name = newSubject.trim()
    if (!name) {
      toast({
        variant: "destructive",
        title: "Thi?u t?n m?n h?c",
        description: "Vui l?ng nh?p t?n m?n h?c.",
      })
      return
    }

    if (items.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "M?n h?c ?? t?n t?i",
        description: "T?n m?n h?c n?y ?? c? trong danh s?ch.",
      })
      return
    }

    try {
      setIsCreating(true)
      const res = await fetch("/api/deck-parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Kh?ng th? t?o m?n h?c")
      }

      setItems((prev) => [...prev, { name, deckCount: 0 }])
      setNewSubject("")
      toast({
        title: "?? t?o m?n h?c",
        description: name,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kh?ng th? t?o m?n h?c"
      toast({
        variant: "destructive",
        title: "T?o m?n h?c th?t b?i",
        description: message,
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <main className="container max-w-5xl mx-auto py-8 space-y-6 stagger">
      {/* Header */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-[11px] text-muted-foreground">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Layers className="h-3 w-3" />
              </span>
              <span>M?n h?c / Ch? ??</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Ch?n m?n ?? xem b? th?
            </h1>
            <p className="text-sm text-muted-foreground">
              C?{" "}
              <span className="font-medium text-primary">{items.length}</span>{" "}
              m?n h?c v?i t?ng c?ng{" "}
              <span className="font-medium text-primary">{totalDecks}</span>{" "}
              b? th?. Nh?n v?o m?t m?n ?? xem c?c deck b?n trong.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Nh?p t?n m?n h?c m?i..."
              className="min-w-[200px] text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={isCreating}
            >
              <Plus className="mr-2 h-4 w-4" />
              T?o m?n h?c
            </Button>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/decks">Xem t?t c? b? th?</Link>
          </Button>
        </div>
      </section>

      {/* Thanh search + sort */}
      <section className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="w-full md:max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="T?m m?n: N?i tim, Ti?ng anh, Ngo?i ti?u h?a..."
              className="pl-9 text-sm"
            />
          </div>
          {hasFilter && (
            <p className="mt-1 text-xs text-muted-foreground">
              ?ang l?c theo: <span className="font-medium">{query}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs md:text-sm">
          <span className="hidden text-muted-foreground md:inline-flex">
            S?p x?p:
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
              T?n
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortBy === "count" ? "default" : "ghost"}
              className="h-7 px-2 text-xs"
              onClick={() => setSortBy("count")}
            >
              <SortAsc className="mr-1 h-3 w-3 rotate-90" />
              S? b? th?
            </Button>
          </div>
        </div>
      </section>

      {/* Danh s?ch parent */}
      {filteredParents.length === 0 ? (
        <section className="flex h-[40vh] flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Hi?n ch?a c? m?n h?c n?o. H?y t?o deck v?i tr??ng subject ?? b?t ??u."
              : "Kh?ng t?m th?y m?n h?c ph? h?p v?i t? kho? t?m ki?m."}
          </p>
          {hasFilter && (
            <Button size="sm" variant="outline" onClick={() => setQuery("")}
            >
              Xo? b? l?c
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
                <Card className="flex h-full flex-col border-border/70 bg-card/80 transition-colors group-hover:border-primary/60 group-hover:bg-card/95">
                  <CardHeader className="pb-2">
                    <CardTitle className="line-clamp-2 text-base font-semibold">
                      {parent.name}
                    </CardTitle>
                    <CardDescription className="mt-1 text-xs text-muted-foreground">
                      {parent.deckCount} b? th? trong m?n n?y
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 pt-1">
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary/80">
                      <Layers className="h-3 w-3" />
                      <span>Nh?n ?? xem deck</span>
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
