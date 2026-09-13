"use client"

import { useEffect, useState } from "react"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"

type ReminderState = "loading" | "unsupported" | "unconfigured" | "denied" | "enabled" | "disabled"

function vapidKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4)
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(raw, character => character.charCodeAt(0))
}

export function StudyReminderControl() {
  const [state, setState] = useState<ReminderState>("loading")
  const [publicKey, setPublicKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    async function load() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported")
        return
      }
      const response = await fetch("/api/notifications")
      const config = await response.json().catch(() => null)
      if (!response.ok || !config?.configured || !config?.publicKey) {
        setState("unconfigured")
        return
      }
      setPublicKey(config.publicKey)
      if (Notification.permission === "denied") {
        setState("denied")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setState(subscription && config.enabledEndpoints?.includes(subscription.endpoint) ? "enabled" : "disabled")
    }
    void load().catch(() => setState("disabled"))
  }, [])

  async function enable() {
    setBusy(true)
    setMessage("")
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(publicKey),
      })
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || "Chưa bật được thông báo")
      setState("enabled")
      setMessage("Đã bật. Mọi flashcard bạn chấm Lại, Khó, Tốt hoặc Dễ sẽ được nhắc khi đến hạn.")
    } catch {
      setMessage("Chưa bật được thông báo. Hãy kiểm tra quyền thông báo của trình duyệt rồi thử lại.")
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setMessage("")
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch("/api/notifications", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        if (!response.ok) throw new Error("Chưa tắt được thông báo")
        // Keep the browser subscription so re-enabling preserves delivery history.
      }
      setState("disabled")
      setMessage("Đã tắt nhắc học trên thiết bị này.")
    } catch {
      setMessage("Chưa tắt được thông báo. Vui lòng thử lại.")
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setMessage("")
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) throw new Error("Thiết bị chưa đăng ký thông báo")
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
      if (!response.ok) throw new Error("Chưa gửi được thông báo thử")
      setMessage("Đã gửi thông báo thử tới thiết bị này.")
    } catch {
      setMessage("Chưa gửi được thông báo thử. Hãy kiểm tra quyền thông báo của thiết bị.")
    } finally {
      setBusy(false)
    }
  }

  if (state === "loading") return <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Đang kiểm tra thông báo…</span>
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">Thiết bị chưa hỗ trợ thông báo ở cửa sổ này. Trên iPhone/iPad, thêm app vào Màn hình chính rồi mở app từ biểu tượng đó để bật thông báo.</p>
  if (state === "unconfigured") return <p className="text-sm text-muted-foreground">Cần cấu hình khóa Web Push trên Vercel trước khi bật nhắc học.</p>
  if (state === "denied") return <p className="text-sm text-destructive">Thông báo đang bị chặn. Hãy cho phép trong cài đặt trình duyệt của thiết bị.</p>

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button type="button" role="switch" aria-checked={state === "enabled"}
        aria-label="Nhắc ôn flashcard" variant={state === "enabled" ? "default" : "outline"}
        onClick={() => void (state === "enabled" ? disable() : enable())}
        disabled={busy || !publicKey} className="gap-3">
        <span aria-hidden="true" className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${state === "enabled" ? "bg-primary-foreground/25" : "bg-muted-foreground/25"}`}>
          <span className={`h-4 w-4 rounded-full bg-current transition-transform motion-reduce:transition-none ${state === "enabled" ? "translate-x-4" : "translate-x-0"}`} />
        </span>
        Nhắc ôn flashcard · {state === "enabled" ? "Bật" : "Tắt"}
      </Button>
      {state === "enabled" && <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={busy} className="gap-2"><Send className="h-4 w-4" />Gửi thử</Button>}
    </div>
    <p role="status" className="text-xs leading-relaxed text-muted-foreground">
      {busy ? "Đang xử lý…" : message || (state === "enabled" ? "Đang bật trên thiết bị này · áp dụng cho cả Lại, Khó, Tốt và Dễ." : "Bật để nhận lời nhắc theo lịch ôn của thẻ. App sẽ hỏi quyền thông báo khi bạn bật.")}
    </p>
  </div>
}
