// app/decks/[deckId]/deck-share-client.tsx
"use client"

import { useState } from "react"
import { Globe, GlobeLock, Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

interface Props {
  deckId: string
  initialIsPublic: boolean
  initialShareToken?: string | null
}

export default function DeckShareClient({
  deckId,
  initialIsPublic,
  initialShareToken,
}: Props) {
  const { toast } = useToast()
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  const [shareToken, setShareToken] = useState(initialShareToken ?? null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = shareToken
    ? `${window.location.origin}/shared/${shareToken}`
    : null

  async function toggleShare() {
    try {
      setLoading(true)
      if (isPublic) {
        // Tắt public
        const res = await fetch(`/api/decks/${deckId}/share`, { method: "DELETE" })
        if (!res.ok) throw new Error("Không thể tắt chia sẻ")
        setIsPublic(false)
        toast({ title: "Đã tắt chia sẻ công khai" })
      } else {
        // Bật public
        const res = await fetch(`/api/decks/${deckId}/share`, { method: "POST" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Không thể chia sẻ")
        setIsPublic(true)
        setShareToken(data.shareToken)
        toast({ title: "Đã bật chia sẻ công khai! 🎉" })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: err instanceof Error ? err.message : "Vui lòng thử lại.",
      })
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Đã copy link!" })
    } catch {
      toast({ variant: "destructive", title: "Không thể copy" })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={isPublic ? "default" : "outline"} className="gap-1 text-xs">
          {isPublic ? (
            <>
              <Globe className="h-3 w-3" /> Công khai
            </>
          ) : (
            <>
              <GlobeLock className="h-3 w-3" /> Riêng tư
            </>
          )}
        </Badge>
        <Button
          size="sm"
          variant={isPublic ? "destructive" : "default"}
          onClick={toggleShare}
          disabled={loading}
          className="gap-1"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          {isPublic ? "Tắt chia sẻ" : "Bật chia sẻ công khai"}
        </Button>
      </div>

      {isPublic && shareUrl && (
        <div className="flex gap-2">
          <Input
            readOnly
            value={shareUrl}
            className="h-8 font-mono text-xs"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      )}

      {isPublic && (
        <p className="text-[11px] text-muted-foreground">
          Bất kỳ ai có link đều có thể xem và clone bộ thẻ này.
        </p>
      )}
    </div>
  )
}
