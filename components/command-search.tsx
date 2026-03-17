// components/command-search.tsx
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SearchResult {
  _id: string
  name: string
  subject: string
  type: "deck"
}

export function CommandSearch() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<SearchResult[]>([])
  const router = useRouter()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
    }
  }, [open])

  React.useEffect(() => {
    const search = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const res = await fetch(`/api/decks?search=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json()
          setResults(
            data.map((d: any) => ({
              _id: d._id,
              name: d.name,
              subject: d.subject || "Khác",
              type: "deck",
            }))
          )
        }
      } catch (err) {
        console.error("Search error", err)
      } finally {
        setLoading(false)
      }
    }

    const bounce = setTimeout(search, 300)
    return () => clearTimeout(bounce)
  }, [query])

  const handleSelect = (deckId: string) => {
    setOpen(false)
    router.push(`/decks/${deckId}`)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center justify-between gap-4 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/80 w-full sm:w-64"
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline-block">Tìm kiếm nhanh...</span>
          <span className="sm:hidden">Tìm kiếm...</span>
        </span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 max-w-xl">
          <DialogTitle className="sr-only">Tìm kiếm nâng cao</DialogTitle>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên bộ thẻ..."
              className="flex h-12 w-full border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin opacity-50 text-muted-foreground" />}
          </div>
          
          <ScrollArea className="max-h-[60vh]">
            {query.trim() && results.length === 0 && !loading && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Không tìm thấy kết quả nào.
              </p>
            )}
            
            {results.length > 0 && (
              <div className="p-2 space-y-1">
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Decks</p>
                {results.map((result) => (
                  <button
                    key={result._id}
                    onClick={() => handleSelect(result._id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer text-left"
                  >
                    <span className="font-medium text-foreground truncate mr-2">{result.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{result.subject}</span>
                  </button>
                ))}
              </div>
            )}
            
            {!query.trim() && (
              <div className="p-4 text-center text-xs text-muted-foreground space-y-1">
                <p>Gõ phím để tìm bộ flashcard của bạn.</p>
                <p>Sử dụng <kbd className="rounded border bg-muted px-1">↑</kbd> <kbd className="rounded border bg-muted px-1">↓</kbd> để cuộn và <kbd className="rounded border bg-muted px-1">Enter</kbd> để chọn.</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
