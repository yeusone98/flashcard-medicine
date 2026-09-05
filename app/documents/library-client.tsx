"use client"
import { useEffect, useState, useRef } from "react"
import Link from "@/components/navigation-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Upload, Loader2 } from "lucide-react"
import { documentRequest, type DocumentInfo } from "./document-client"

export default function DocumentLibrary() {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState("")
  const [title, setTitle] = useState("")
  const [subject, setSubject] = useState("")
  const [filter, setFilter] = useState("")
  const [edit, setEdit] = useState<DocumentInfo | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  async function refresh() { setDocs(await documentRequest<DocumentInfo[]>("/api/documents")) }
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setLoading(false)) }, [])
  async function action(work: () => Promise<void>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError("")
    try { await work(); await refresh() } catch (e) { setError(e instanceof Error ? e.message : "Thao tác thất bại."); await refresh().catch(() => {}) }
    finally { lock.current = false; setBusy(false); setProgress("") }
  }
  async function upload() {
    const file = input.current?.files?.[0]
    if (!file) { setError("Chọn file PDF trước nhé."); return }
    await action(async () => {
      if (file.size > 10 * 1024 * 1024 || await file.slice(0, 5).text() !== "%PDF-") throw new Error("Chọn file PDF hợp lệ, tối đa 10 MB.")
      setProgress("Chuẩn bị tải lên…")
      const upload = await documentRequest<{ id: string; uploadUrl: string; params: Record<string, string | number | boolean>; apiKey: string; signature: string }>("/api/documents", { method: "POST", body: JSON.stringify({ title: title.trim() || file.name.replace(/\.pdf$/i, ""), subject, bytes: file.size }) })
      const form = new FormData(); form.append("file", file); form.append("api_key", upload.apiKey); form.append("signature", upload.signature)
      for (const [key, value] of Object.entries(upload.params)) form.append(key, String(value))
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhr.open("POST", upload.uploadUrl); xhr.timeout = 120000
        xhr.upload.onprogress = event => { if (event.lengthComputable) setProgress(`Đang tải ${Math.round(event.loaded / event.total * 100)}%`) }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Tải file thất bại. Xóa bản tải dở rồi thử lại."))
        xhr.onerror = xhr.ontimeout = () => reject(new Error("Kết nối tải file bị gián đoạn. Có thể thử xác nhận bản tải dở bên dưới."))
        xhr.send(form)
      })
      setProgress("Kiểm tra PDF…")
      await documentRequest(`/api/documents/${upload.id}`, { method: "PATCH", body: JSON.stringify({ complete: true }) })
      setTitle(""); setSubject(""); if (input.current) input.current.value = ""
    })
  }
  return <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 px-4 py-6">
    <header><h1 className="text-2xl font-semibold">Tài liệu học</h1><p className="mt-2 text-sm text-muted-foreground">Đọc PDF, lưu ghi chú và tạo thẻ ngay từ tài liệu của bạn.</p></header>
    <Card><CardContent className="space-y-4 pt-6">
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm">Tên tài liệu<Input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="Để trống để dùng tên file" /></label><label className="space-y-2 text-sm">Môn học<Input value={subject} onChange={e => setSubject(e.target.value)} maxLength={100} placeholder="Ví dụ: Giải phẫu" /></label></div>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 space-y-2 text-sm">File PDF<input ref={input} type="file" accept=".pdf,application/pdf" disabled={busy} className="block w-full min-w-0 rounded-lg border p-2 text-sm" /></label><Button onClick={upload} disabled={busy}><Upload />Tải PDF lên</Button></div>
      <p className="text-xs text-muted-foreground">Riêng tư theo tài khoản · Tối đa 10 MB/file · {docs.length}/20 tài liệu</p>
      {progress && <p role="status" className="text-sm">{progress}</p>}
    </CardContent></Card>
    {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <label className="block max-w-md space-y-2 text-sm">Tìm tài liệu hoặc môn học<Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Nhập tên để lọc…" /></label>
    {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Đang tải thư viện…</p> : !docs.length ? <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Tải PDF đầu tiên để bắt đầu đọc.</p> : <div className="grid gap-4 md:grid-cols-2">{docs.filter(d => `${d.title} ${d.subject}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(doc => <Card key={doc.id} className="min-w-0"><CardContent className="space-y-4 pt-6">
      <div className="flex gap-3"><FileText className="h-6 w-6 shrink-0 text-primary" /><div className="min-w-0"><h2 className="break-words font-semibold">{doc.title}</h2><p className="text-sm text-muted-foreground">{doc.subject || "Chưa phân môn"} · {(doc.bytes / 1024 / 1024).toFixed(1)} MB</p></div></div>
      <div className="flex flex-wrap gap-2">{doc.status === "ready" ? <Button asChild><Link href={`/documents/${doc.id}`}>Đọc tiếp · trang {doc.page}</Link></Button> : <Button variant="outline" disabled={busy} onClick={() => action(async () => { await documentRequest(`/api/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ complete: true }) }) })}>Xác nhận bản tải dở</Button>}
      <Button variant="outline" onClick={() => setEdit(doc)} disabled={busy}>Đổi tên / môn</Button><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Xóa “${doc.title}” cùng ghi chú và dấu trang? Thẻ đã tạo vẫn được giữ.`)) void action(async () => { await documentRequest(`/api/documents/${doc.id}`, { method: "DELETE" }) }) }}>Xóa</Button></div>
      {edit?.id === doc.id && <form className="space-y-3 border-t pt-3" onSubmit={e => { e.preventDefault(); void action(async () => { await documentRequest(`/api/documents/${doc.id}`, { method: "PATCH", body: JSON.stringify({ title: edit.title, subject: edit.subject }) }); setEdit(null) }) }}><Input aria-label="Tên mới" value={edit.title} maxLength={160} onChange={e => setEdit({ ...edit, title: e.target.value })} /><Input aria-label="Môn học mới" value={edit.subject} maxLength={100} onChange={e => setEdit({ ...edit, subject: e.target.value })} /><Button disabled={busy}>Lưu</Button><Button type="button" variant="ghost" onClick={() => setEdit(null)}>Hủy</Button></form>}
    </CardContent></Card>)}</div>}
  </div>
}
