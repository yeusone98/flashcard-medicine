"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { StudyDisclosure } from "@/components/study-layout"

type NoteState = { draft: string; saved: string; saving: boolean; error: string }

export function QuestionNote({ questionId, initialNote }: { questionId: string; initialNote: string }) {
  // Keep drafts and pending responses attached to their question when navigating.
  const [notes, setNotes] = useState<Record<string, NoteState>>({})
  const pending = useRef(new Set<string>())
  const current = notes[questionId] ?? { draft: initialNote, saved: initialNote, saving: false, error: "" }
  const dirty = current.draft !== current.saved
  function update(id: string, fallback: NoteState, change: Partial<NoteState>) {
    setNotes(previous => ({ ...previous, [id]: { ...(previous[id] ?? fallback), ...change } }))
  }
  async function save() {
    if (pending.current.has(questionId) || !dirty) return
    const id = questionId
    const note = current.draft
    pending.current.add(id)
    update(id, current, { saving: true, error: "" })
    try {
      const response = await fetch(`/api/questions/${id}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      })
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        throw new Error(result?.error || "Không lưu được ghi chú. Bạn thử lại nhé.")
      }
      update(id, current, { saved: note, saving: false })
    } catch (error) {
      update(id, current, { saving: false, error: error instanceof Error ? error.message : "Không lưu được ghi chú" })
    } finally {
      pending.current.delete(id)
    }
  }
  return <StudyDisclosure title={`Ghi chú cá nhân${dirty ? " · Chưa lưu" : current.saved ? " · Đã có ghi chú" : ""}`}>
    <label htmlFor={`question-note-${questionId}`} className="block text-sm text-muted-foreground">
      Ghi lại cách nhớ, lý do chọn đáp án hoặc điều cần ôn thêm cho câu này.
    </label>
    <textarea
      id={`question-note-${questionId}`}
      value={current.draft}
      onChange={event => update(questionId, current, { draft: event.target.value, error: "" })}
      maxLength={5000}
      placeholder="Ghi chú của bạn…"
      className="flex min-h-28 w-full min-w-0 resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
    />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground" role="status">
        {current.saving ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu" : current.saved ? "Đã lưu" : "Chỉ bạn xem được ghi chú"} · {current.draft.length}/5.000
      </span>
      <Button type="button" size="sm" onClick={save} disabled={!dirty || current.saving}>
        {current.saving ? "Đang lưu…" : "Lưu ghi chú"}
      </Button>
    </div>
    {current.error && <p role="alert" className="text-sm text-destructive">{current.error}</p>}
  </StudyDisclosure>
}
