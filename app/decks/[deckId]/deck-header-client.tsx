// app/decks/[deckId]/deck-header-client.tsx
"use client"

import { useState } from "react"
import { Pencil, Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

type DeckHeaderClientProps = {
  deckId: string
  name: string
  description?: string | null
  subject?: string | null
}

export default function DeckHeaderClient({
  deckId,
  name,
  description,
  subject,
}: DeckHeaderClientProps) {
  const NAME_MAX = 80
  const DESC_MAX = 500
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [nameValue, setNameValue] = useState(name)
  const [descriptionValue, setDescriptionValue] = useState(description ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const trimmedName = nameValue.trim()
  const nameTooLong = nameValue.length > NAME_MAX
  const descTooLong = descriptionValue.length > DESC_MAX
  const canSave =
    trimmedName.length > 0 && !nameTooLong && !descTooLong && !isSaving

  const handleCancel = () => {
    setNameValue(name)
    setDescriptionValue(description ?? "")
    setIsEditing(false)
  }

  const handleSave = async () => {
    const trimmedDescription = descriptionValue.trim()

    if (!trimmedName) {
      setNameValue(trimmedName)
      setDescriptionValue(trimmedDescription)
      toast({
        variant: "destructive",
        title: "Thiếu tên deck",
        description: "Vui lòng nhập tên deck trước khi lưu.",
      })
      return
    }

    if (nameTooLong || descTooLong) {
      toast({
        variant: "destructive",
        title: "Nội dung quá dài",
        description: "Vui lòng rút gọn để lưu.",
      })
      return
    }

    try {
      setIsSaving(true)
      const res = await fetch(`/api/decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: trimmedDescription,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || "Cập nhật thất bại")
      }

      setNameValue(trimmedName)
      setDescriptionValue(trimmedDescription)
      toast({
        title: "Đã lưu",
        description: "Tên và mô tả deck đã được cập nhật.",
      })
      setIsEditing(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Cập nhật thất bại"
      toast({
        variant: "destructive",
        title: "Không thể cập nhật",
        description: message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Pencil className="h-3 w-3" />
        </span>
        <span>Tổng quan deck</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isEditing ? (
          <div className="w-full max-w-2xl space-y-1">
            <Input
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              className="h-10 text-base md:text-lg"
              maxLength={NAME_MAX}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {trimmedName.length === 0
                  ? "Tên deck không được để trống."
                  : "Tên deck ngắn gọn giúp dễ tìm."}
              </span>
              <span className={nameTooLong ? "text-destructive" : undefined}>
                {nameValue.length}/{NAME_MAX}
              </span>
            </div>
          </div>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {nameValue}
          </h1>
        )}

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={!canSave}
              >
                <Save className="h-4 w-4" />
                Lưu
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                Huỷ
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-4 w-4" />
              Sửa nhanh
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-1">
          <textarea
            value={descriptionValue}
            onChange={(event) => setDescriptionValue(event.target.value)}
            className="min-h-[110px] w-full rounded-lg border border-input/70 bg-background/70 px-3 py-2 text-sm text-foreground shadow-sm outline-none ring-0 focus:border-primary/60 focus:ring-2 focus:ring-primary/30"
            placeholder="Nhập mô tả deck..."
            maxLength={DESC_MAX}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Mô tả giúp người học hiểu mục tiêu của deck.</span>
            <span className={descTooLong ? "text-destructive" : undefined}>
              {descriptionValue.length}/{DESC_MAX}
            </span>
          </div>
        </div>
      ) : (
        <p className="max-w-2xl text-sm text-muted-foreground">
          {descriptionValue && descriptionValue.trim().length > 0
            ? descriptionValue
            : "Chưa có mô tả cho deck này."}
        </p>
      )}

      {subject ? (
        <Badge variant="outline" className="text-[11px] uppercase">
          {subject}
        </Badge>
      ) : null}
    </div>
  )
}
