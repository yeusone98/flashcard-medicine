// app/deck-parents/deck-parents-client.tsx
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Layers, Plus, Search, SortAsc, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

  const [editingSubject, setEditingSubject] = useState<ParentInfo | null>(null)
  const [editName, setEditName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  const [deletingSubject, setDeletingSubject] = useState<ParentInfo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

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
        title: "Thiếu tên môn học",
        description: "Vui lòng nhập tên môn học.",
      })
      return
    }

    if (items.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "Môn học đã tồn tại",
        description: "Tên môn học này đã có trong danh sách.",
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
        throw new Error(data?.error || "Không thể tạo môn học")
      }

      setItems((prev) => [...prev, { name, deckCount: 0 }])
      setNewSubject("")

      toast({
        title: "Đã tạo môn học",
        description: name,
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể tạo môn học"

      toast({
        variant: "destructive",
        title: "Tạo môn học thất bại",
        description: message,
      })
    } finally {
      setIsCreating(false)
    }
  }
  const handleRename = async () => {
    if (!editingSubject) return
    const newName = editName.trim()

    if (!newName) {
      toast({
        variant: "destructive",
        title: "Thiếu thông tin",
        description: "Vui lòng nhập tên mới",
      })
      return
    }

    if (newName.toLowerCase() === editingSubject.name.toLowerCase()) {
      setEditingSubject(null)
      return
    }

    if (items.some((p) => p.name.toLowerCase() === newName.toLowerCase())) {
      toast({
        variant: "destructive",
        title: "Trùng tên",
        description: "Tên môn học này đã tồn tại trong danh sách.",
      })
      return
    }

    try {
      setIsUpdating(true)
      const res = await fetch("/api/deck-parents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName: editingSubject.name, newName }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Không thể đổi tên môn học")
      }

      setItems((prev) =>
        prev.map((p) =>
          p.name === editingSubject.name ? { ...p, name: newName } : p
        )
      )

      toast({
        title: "Thành công",
        description: `Đã đổi tên thành ${newName}`,
      })
      setEditingSubject(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Đổi tên thất bại",
        description: error instanceof Error ? error.message : "Đã có lỗi xảy ra",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingSubject) return

    try {
      setIsDeleting(true)
      const res = await fetch("/api/deck-parents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: deletingSubject.name }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || "Không thể xóa môn học")
      }

      setItems((prev) => prev.filter((p) => p.name !== deletingSubject.name))

      toast({
        title: "Thành công",
        description: `Đã xóa môn học ${deletingSubject.name}`,
      })
      setDeletingSubject(null)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Xóa thất bại",
        description: error instanceof Error ? error.message : "Đã có lỗi xảy ra",
      })
    } finally {
      setIsDeleting(false)
    }
  }
  return (
    <>
      <main className="container mx-auto max-w-5xl space-y-6 py-8 stagger">
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
              <span>Môn học / Chủ đề</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Chọn môn để xem bộ thẻ
            </h1>
            <p className="text-sm text-muted-foreground">
              Có{" "}
              <span className="font-medium text-primary">{items.length}</span>{" "}
              môn học với tổng cộng{" "}
              <span className="font-medium text-primary">{totalDecks}</span>{" "}
              bộ thẻ. Nhấn vào một môn để xem các deck bên trong.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Nhập tên môn học mới..."
              className="min-w-[220px] text-sm"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={isCreating}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tạo môn học
            </Button>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/decks">Xem tất cả bộ thẻ</Link>
          </Button>
        </div>
      </section>

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
          {hasFilter ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Đang lọc theo: <span className="font-medium">{query}</span>
            </p>
          ) : null}
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

      {filteredParents.length === 0 ? (
        <section className="flex h-[40vh] flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            {items.length === 0
              ? "Hiện chưa có môn học nào. Hãy tạo deck với trường subject để bắt đầu."
              : "Không tìm thấy môn học phù hợp với từ khóa tìm kiếm."}
          </p>
          {hasFilter ? (
            <Button size="sm" variant="outline" onClick={() => setQuery("")}>
              Xóa bộ lọc
            </Button>
          ) : null}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <CardTitle className="line-clamp-2 text-base font-semibold">
                          {parent.name}
                        </CardTitle>
                        <CardDescription className="mt-1 text-xs text-muted-foreground">
                          {parent.deckCount} bộ thẻ trong môn này
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2 text-muted-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault()
                              setEditingSubject(parent)
                              setEditName(parent.name)
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" /> Đổi tên
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            disabled={parent.deckCount > 0}
                            onClick={(e) => {
                              e.preventDefault()
                              if (parent.deckCount === 0) setDeletingSubject(parent)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pt-1">
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary/80">
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

      <Dialog open={!!editingSubject} onOpenChange={(open) => !open && setEditingSubject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi tên môn học</DialogTitle>
            <DialogDescription>
              Tên mới sẽ được cập nhật cho tất cả bộ thẻ thuộc môn này.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Tên môn học mới"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubject(null)} disabled={isUpdating}>
              Hủy
            </Button>
            <Button onClick={handleRename} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingSubject} onOpenChange={(open) => !open && setDeletingSubject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa môn học</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa môn học <strong className="text-foreground">{deletingSubject?.name}</strong> không?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeletingSubject(null)} disabled={isDeleting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
