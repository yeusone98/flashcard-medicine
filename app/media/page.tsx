"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, FolderSync, Loader2, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type MediaItem = {
  id: string
  url: string
  kind: "image" | "audio"
  publicId?: string
  format?: string
  bytes?: number
  width?: number
  height?: number
  duration?: number
  createdAt?: string
}

type MediaResponse = {
  items: MediaItem[]
  total: number
  page: number
  limit: number
}

const formatBytes = (value?: number) => {
  if (!value && value !== 0) return "-"
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export default function MediaLibraryPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [type, setType] = useState<"all" | "image" | "audio">("all")
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [orphanReport, setOrphanReport] = useState<{
    checked: number
    orphanCount: number
  } | null>(null)
  const [cleaning, setCleaning] = useState(false)

  const fetchMedia = async (reset: boolean) => {
    try {
      if (reset) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const nextPage = reset ? 1 : page + 1
      const params = new URLSearchParams()
      params.set("page", String(nextPage))
      params.set("limit", "36")
      if (type !== "all") params.set("type", type)
      if (query) params.set("q", query)

      const res = await fetch(`/api/media?${params.toString()}`)
      const data = (await res.json()) as MediaResponse

      if (!res.ok) {
        throw new Error((data as any)?.error || "Failed to load media")
      }

      setItems((prev) => (reset ? data.items : [...prev, ...data.items]))
      setTotal(data.total ?? 0)
      setPage(nextPage)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Load failed"
      toast({
        variant: "destructive",
        title: "Media load failed",
        description: message,
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void fetchMedia(true)
  }, [type, query])

  const canLoadMore = items.length < total

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Đã copy URL" })
    } catch {
      toast({
        variant: "destructive",
        title: "Copy thất bại",
        description: "Không thể copy URL.",
      })
    }
  }

  const handleScanOrphans = async () => {
    try {
      setCleaning(true)
      const res = await fetch("/api/media/cleanup?dryRun=1", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Không thể quét orphan")
      }
      setOrphanReport({
        checked: data.checked ?? 0,
        orphanCount: data.orphanCount ?? 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed"
      toast({
        variant: "destructive",
        title: "Scan thất bại",
        description: message,
      })
    } finally {
      setCleaning(false)
    }
  }

  const handleCleanup = async () => {
    try {
      setCleaning(true)
      const res = await fetch("/api/media/cleanup", { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Không thể dọn orphan")
      }
      toast({
        title: "Đã dọn media",
        description: `Xóa ${data.removedCount ?? 0} file.`,
      })
      setOrphanReport(null)
      void fetchMedia(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cleanup failed"
      toast({
        variant: "destructive",
        title: "Cleanup thất bại",
        description: message,
      })
    } finally {
      setCleaning(false)
    }
  }

  const summary = useMemo(() => {
    if (!total) return "Chưa có media"
    return `Đang hiển thị ${items.length}/${total}`
  }, [items.length, total])

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 stagger">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Media library</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý ảnh/âm thanh đã upload, copy URL nhanh và dọn file không dùng.
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Bộ lọc & dọn dẹp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              setQuery(queryInput.trim())
            }}
          >
            <div className="flex items-center gap-2">
              {(["all", "image", "audio"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={type === value ? "default" : "outline"}
                  onClick={() => setType(value)}
                >
                  {value === "all"
                    ? "Tất cả"
                    : value === "image"
                      ? "Ảnh"
                      : "Âm thanh"}
                </Button>
              ))}
            </div>

            <Input
              placeholder="Tìm theo URL hoặc định dạng..."
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              className="min-w-[220px] flex-1"
            />
            <Button type="submit" size="sm">
              Tìm
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{summary}</span>
            {orphanReport && (
              <Badge variant="outline">
                Orphans: {orphanReport.orphanCount} / {orphanReport.checked}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleScanOrphans}
              disabled={cleaning}
            >
              {cleaning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderSync className="mr-2 h-4 w-4" />
              )}
              Quét orphan
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={handleCleanup}
              disabled={cleaning || !orphanReport?.orphanCount}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Dọn orphan
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Chưa có media nào.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      item.kind === "audio"
                        ? "border-amber-500/60 text-amber-200"
                        : "border-primary/50 text-primary",
                    )}
                  >
                    {item.kind === "audio" ? "Âm thanh" : "Ảnh"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.format?.toUpperCase() ?? "-"} · {formatBytes(item.bytes)}
                  </span>
                </div>

                {item.kind === "image" ? (
                  <img
                    src={item.url}
                    alt={item.publicId ?? "Media"}
                    className="h-44 w-full rounded-lg border border-primary/20 object-cover"
                  />
                ) : (
                  <audio controls className="w-full">
                    <source src={item.url} />
                  </audio>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {item.url}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleCopy(item.url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => fetchMedia(false)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Tải thêm
          </Button>
        </div>
      )}
    </main>
  )
}
