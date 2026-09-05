"use client"

import { useSyncExternalStore, useState, type ReactNode } from "react"
import { Focus, PanelsTopLeft, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"

let memoryPreference: boolean | null = null
function readFocusPreference() {
  try {
    const saved = localStorage.getItem("study-focus")
    if (saved !== null) return saved === "true"
  } catch { /* Use the in-memory preference when storage is unavailable. */ }
  return memoryPreference ?? window.matchMedia("(max-width: 767px)").matches
}
function subscribeFocus(change: () => void) {
  const screen = window.matchMedia("(max-width: 767px)")
  window.addEventListener("study-focus-change", change)
  window.addEventListener("storage", change)
  screen.addEventListener("change", change)
  return () => {
    window.removeEventListener("study-focus-change", change)
    window.removeEventListener("storage", change)
    screen.removeEventListener("change", change)
  }
}
export function useStudyFocus() {
  const focused = useSyncExternalStore(subscribeFocus, readFocusPreference, () => false)
  const toggle = () => {
    memoryPreference = !focused
    try { localStorage.setItem("study-focus", String(!focused)) } catch { /* Optional preference storage. */ }
    window.dispatchEvent(new Event("study-focus-change"))
  }
  return { focused, toggle }
}

export function StudyFocusToggle({ focused, onToggle }: { focused: boolean; onToggle: () => void }) {
  return <Button variant="outline" onClick={onToggle} aria-pressed={focused} className="min-h-11 gap-2 text-sm">
    {focused ? <PanelsTopLeft className="h-4 w-4" /> : <Focus className="h-4 w-4" />}
    {focused ? "Hiện đầy đủ" : "Tập trung học"}
  </Button>
}

export function StudyDisclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return <details className="study-disclosure rounded-2xl border bg-card" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {title}<ChevronDown aria-hidden className="h-4 w-4 shrink-0 transition-transform" />
    </summary>
    <div className="space-y-4 px-3 pb-3">{children}</div>
  </details>
}
