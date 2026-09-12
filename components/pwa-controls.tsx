"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { Download, RefreshCw, Share, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)

function subscribeStandalone(change: () => void) {
  const media = window.matchMedia("(display-mode: standalone)")
  media.addEventListener("change", change)
  window.addEventListener("appinstalled", change)
  return () => {
    media.removeEventListener("change", change)
    window.removeEventListener("appinstalled", change)
  }
}

function subscribeConnection(change: () => void) {
  window.addEventListener("online", change)
  window.addEventListener("offline", change)
  return () => {
    window.removeEventListener("online", change)
    window.removeEventListener("offline", change)
  }
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const standalone = useSyncExternalStore(subscribeStandalone, isStandalone, () => false)
  const [installAccepted, setInstallAccepted] = useState(false)
  const installed = standalone || installAccepted
  const [showHelp, setShowHelp] = useState(false)
  const [isIos] = useState(() =>
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent),
  )

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstallAccepted(true)
      setInstallPrompt(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function tryInstall() {
    if (installed) return
    if (!installPrompt) {
      setShowHelp(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") setInstallAccepted(true)
    setInstallPrompt(null)
  }

  return <>
    <Button type="button" onClick={() => void tryInstall()} disabled={installed} className="gap-2">
      <Download aria-hidden className="h-4 w-4" />
      {installed ? "Đã cài trên thiết bị" : "Cài ứng dụng"}
    </Button>
    <Dialog open={showHelp} onOpenChange={setShowHelp}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cài Flashcard Medicine</DialogTitle></DialogHeader>
        {isIos ? (
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>Mở trang này bằng Safari, chạm nút <strong className="text-foreground">Chia sẻ</strong> ở thanh công cụ.</p>
            <p className="flex items-center gap-2"><Share aria-hidden className="h-4 w-4 text-primary" /> Chọn <strong className="text-foreground">Thêm vào Màn hình chính</strong>, rồi bấm Thêm.</p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Trình duyệt chưa mở hộp cài tự động. Trong menu Chrome hoặc Edge, chọn <strong className="text-foreground">Cài đặt ứng dụng</strong>. Trên iPhone, mở bằng Safari rồi chọn Chia sẻ → Thêm vào Màn hình chính.
          </p>
        )}
      </DialogContent>
    </Dialog>
  </>
}

export function PwaAppStatus() {
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine, () => true)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    navigator.serviceWorker?.getRegistration().then(registration => {
      if (!registration) return
      if (registration.waiting) setWaitingWorker(registration.waiting)
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(worker)
          }
        })
      })
    }).catch(() => undefined)

    const controllerChanged = () => window.location.reload()
    navigator.serviceWorker?.addEventListener("controllerchange", controllerChanged)
    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged)
    }
  }, [])

  if (online && !waitingWorker) return null
  return <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border bg-card p-3 text-sm text-card-foreground shadow-xl" role="status">
    {!online ? (
      <span className="flex items-center gap-2"><WifiOff aria-hidden className="h-4 w-4 text-destructive" />Mất kết nối. Dữ liệu mới chưa thể đồng bộ.</span>
    ) : <>
      <span>Có phiên bản mới của ứng dụng.</span>
      <Button size="sm" className="shrink-0 gap-1" onClick={() => waitingWorker?.postMessage({ type: "SKIP_WAITING" })}>
        <RefreshCw aria-hidden className="h-4 w-4" /> Cập nhật
      </Button>
    </>}
  </div>
}
