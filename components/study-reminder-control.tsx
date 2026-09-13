"use client"

import { useEffect, useState } from "react"
import { Bell, BellOff, Loader2, Send } from "lucide-react"

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
      setState(await registration.pushManager.getSubscription() ? "enabled" : "disabled")
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
      setMessage("Đã bật nhắc thẻ Lại / Khó khi đến hạn. Lịch máy chủ cần được cấu hình mỗi phút; thông báo có thể đến trễ do mạng hoặc thiết bị.")
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
        await subscription.unsubscribe()
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
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">Trình duyệt này chưa hỗ trợ thông báo PWA.</p>
  if (state === "unconfigured") return <p className="text-sm text-muted-foreground">Cần cấu hình khóa Web Push trên Vercel trước khi bật nhắc học.</p>
  if (state === "denied") return <p className="text-sm text-destructive">Thông báo đang bị chặn. Hãy cho phép trong cài đặt trình duyệt của thiết bị.</p>

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {state === "enabled" ? <>
        <Button type="button" variant="outline" onClick={() => void sendTest()} disabled={busy} className="gap-2"><Send className="h-4 w-4" />Gửi thử</Button>
        <Button type="button" variant="ghost" onClick={() => void disable()} disabled={busy} className="gap-2"><BellOff className="h-4 w-4" />Tắt nhắc học</Button>
      </> : (
        <Button type="button" variant="outline" onClick={() => void enable()} disabled={busy || !publicKey} className="gap-2"><Bell className="h-4 w-4" />Bật nhắc thẻ Lại / Khó</Button>
      )}
    </div>
    <p role="status" className="text-xs leading-relaxed text-muted-foreground">
      {busy ? "Đang xử lý…" : message || (state === "enabled" ? "Đang bật trên thiết bị này · nhắc thẻ Lại / Khó đến hạn, kiểm tra mỗi phút khi lịch máy chủ đã được cấu hình." : "Chỉ hỏi quyền thông báo sau khi bạn bấm bật.")}
    </p>
  </div>
}
