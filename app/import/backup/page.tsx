"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function RestoreBackupPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function restore() {
    if (!file || busy) return
    setBusy(true)
    setError("")
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("Bản sao lưu vượt 4 MB. Chọn bản sao lưu nhỏ hơn để tải lên.")
      const backup = JSON.parse(await file.text())
      const res = await fetch("/api/import/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(backup) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Không thể khôi phục")
      router.push(`/decks/${data.deckId}`)
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể khôi phục") }
    finally { setBusy(false) }
  }
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-10">
    <h1 className="text-2xl font-semibold">Khôi phục bản sao lưu</h1>
    <p>Chọn file JSON đã xuất từ bộ thẻ. Nội dung, lịch ôn và lịch sử học sẽ được khôi phục vào một bộ thẻ mới.</p>
    <p className="text-sm text-muted-foreground">Tối đa 4 MB. Ảnh và âm thanh được lưu dưới dạng liên kết; cần giữ các file gốc trên Cloudinary.</p>
    <label htmlFor="backup-file">File bản sao lưu JSON</label>
    <Input id="backup-file" type="file" accept=".json,application/json" disabled={busy} onChange={e => setFile(e.target.files?.[0] ?? null)} />
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Button disabled={!file || busy} onClick={() => void restore()}>{busy ? "Đang khôi phục…" : "Khôi phục"}</Button>
  </main>
}
