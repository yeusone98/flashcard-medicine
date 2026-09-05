"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import type { PDFDocumentProxy } from "pdfjs-dist"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
import Link from "@/components/navigation-link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { documentRequest, type DocumentInfo } from "../document-client"

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
const options = { cMapUrl: "/pdf-assets/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdf-assets/standard_fonts/", wasmUrl: "/pdf-assets/wasm/", isEvalSupported: false }
export default function PdfReader({ document: initial }: { document: DocumentInfo }) {
  const [doc, setDoc] = useState(initial)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [loadedBytes, setLoadedBytes] = useState(0)
  const [retry, setRetry] = useState(0)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(initial.page)
  const [pageInput, setPageInput] = useState(String(initial.page))
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(600)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState("")
  const [note, setNote] = useState("")
  const [notePage, setNotePage] = useState(initial.page)
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [results, setResults] = useState<{ page: number; snippet: string }[]>([])
  const [decks, setDecks] = useState<{ _id: string; name: string }[]>([])
  const [deckId, setDeckId] = useState("")
  const [front, setFront] = useState("")
  const [back, setBack] = useState("")
  const [sourcePage, setSourcePage] = useState(initial.page)
  const [sideOpen, setSideOpen] = useState(false)
  const [draft, setDraft] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const mutationLock = useRef(false)
  const saveQueue = useRef(Promise.resolve())
  const searchGeneration = useRef(0)
  const textCache = useRef(new Map<number, string>())
  const requestId = useRef<string | null>(null)
  const file = useMemo(() => bytes ? { data: bytes } : null, [bytes])
  const base = `/api/documents/${doc.id}`
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setError(""); setLoadedBytes(0)
      const data = new Uint8Array(initial.bytes)
      let offset = 0
      while (offset < data.length) {
        const res = await fetch(`/api/documents/${initial.id}/file?offset=${offset}`, { signal: controller.signal })
        if (!res.ok) { const json = await res.json().catch(() => null); throw new Error(json?.error || "Không tải được PDF.") }
        const chunk = new Uint8Array(await res.arrayBuffer())
        if (!chunk.length || chunk.length > data.length - offset) throw new Error("Dữ liệu PDF không đầy đủ.")
        data.set(chunk, offset); offset += chunk.length; setLoadedBytes(offset)
      }
      setBytes(data)
    }
    void load().catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => { controller.abort(); searchGeneration.current++ }
  }, [initial.id, initial.bytes, retry])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 24)))
    observer.observe(element); return () => observer.disconnect()
  }, [])
  useEffect(() => { documentRequest<{ _id: string; name: string }[]>("/api/decks").then(setDecks).catch(() => setError("Không tải được danh sách bộ thẻ. Tải lại trang để thử lại.")) }, [])
  async function mutate(body: unknown) {
    if (mutationLock.current) return
    mutationLock.current = true; setBusy(true); setError(""); setMessage("")
    try {
      await documentRequest(base, { method: "PATCH", body: JSON.stringify(body) })
      setDoc(await documentRequest<DocumentInfo>(base)); setMessage("Đã lưu."); return true
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa lưu được.") }
    finally { mutationLock.current = false; setBusy(false) }
  }
  function navigate(next: number) {
    if (!pdf) return
    const valid = Math.max(1, Math.min(pdf.numPages, Math.trunc(next) || 1))
    setPage(valid); setPageInput(String(valid)); setSelection("")
    // Requests are serialized so a slower old save cannot overwrite a new page.
    saveQueue.current = saveQueue.current.then(async () => {
      await documentRequest(base, { method: "PATCH", body: JSON.stringify({ page: valid }), keepalive: true })
    }).catch(() => setError("Chưa nhớ được vị trí đọc. Chuyển trang lại khi có mạng để lưu."))
  }
  function readSelection() {
    const selected = window.getSelection()
    if (selected?.rangeCount && viewport.current?.contains(selected.getRangeAt(0).commonAncestorContainer)) setSelection(selected.toString().trim().slice(0, 10000))
  }
  async function search() {
    if (!pdf || !query.trim()) return
    const generation = ++searchGeneration.current
    setSearching(true); setSearched(false); setResults([])
    const found: { page: number; snippet: string }[] = []
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        if (generation !== searchGeneration.current) return
        let text = textCache.current.get(n)
        if (text === undefined) {
          const p = await pdf.getPage(n); const content = await p.getTextContent()
          text = content.items.map(item => "str" in item ? item.str : "").join(" ")
          textCache.current.set(n, text)
        }
        const position = text.toLocaleLowerCase().indexOf(query.trim().toLocaleLowerCase())
        if (position !== -1) found.push({ page: n, snippet: text.slice(Math.max(0, position - 35), position + 120) })
        if (found.length >= 100) break
      }
      if (generation === searchGeneration.current) { setResults(found); setSearched(true) }
    } catch { setError("Không tìm được chữ trong PDF này.") }
    finally { if (generation === searchGeneration.current) setSearching(false) }
  }
  async function createCard() {
    if (mutationLock.current) return
    mutationLock.current = true; setBusy(true); setError("")
    requestId.current ??= crypto.randomUUID()
    try {
      await documentRequest(`${base}/flashcards`, { method: "POST", body: JSON.stringify({ deckId, front, back, page: sourcePage, requestId: requestId.current }) })
      setMessage("Đã tạo flashcard và lưu nguồn tài liệu."); setDraft(false); setFront(""); setBack(""); requestId.current = null
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa tạo được thẻ.") }
    finally { setBusy(false); mutationLock.current = false }
  }
  return <div ref={root} className="pdf-reader mx-auto w-full min-w-0 max-w-[1500px] space-y-4 bg-background px-3 py-5 sm:px-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><Link href="/documents" className="text-sm text-muted-foreground">← Tài liệu học</Link><h1 className="mt-2 break-words text-xl font-semibold">{doc.title}</h1><p className="text-sm text-muted-foreground">{doc.subject}</p></div><Button variant="outline" onClick={() => { if (window.document.fullscreenElement) void window.document.exitFullscreen(); else void root.current?.requestFullscreen().catch(() => setError("Trình duyệt này chưa hỗ trợ toàn màn hình. Bạn có thể thu gọn thanh công cụ trình duyệt.")) }}>Toàn màn hình</Button></header>
    {error && <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}{!bytes && <Button variant="outline" className="ml-2" onClick={() => setRetry(r => r + 1)}>Thử tải lại</Button>}</div>}
    {message && <p role="status" className="text-sm text-primary">{message}</p>}
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <Button variant="outline" disabled={!pdf || page <= 1} onClick={() => navigate(page - 1)}>← Trước</Button>
      <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); navigate(Number(pageInput)) }}><Input aria-label="Số trang" type="number" min={1} max={pdf?.numPages} value={pageInput} onChange={e => setPageInput(e.target.value)} className="w-20" /><span className="text-sm">/ {pdf?.numPages ?? "…"}</span><Button variant="ghost" disabled={!pdf}>Đi</Button></form>
      <Button variant="outline" disabled={!pdf || page >= pdf.numPages} onClick={() => navigate(page + 1)}>Sau →</Button>
      <Button aria-label="Thu nhỏ" variant="outline" disabled={zoom <= .5} onClick={() => setZoom(z => Math.max(.5, z - .25))}>−</Button><span className="text-xs tabular-nums">{Math.round(zoom * 100)}%</span><Button aria-label="Phóng to" variant="outline" disabled={zoom >= 2.5} onClick={() => setZoom(z => Math.min(2.5, z + .25))}>+</Button><Button variant="ghost" onClick={() => setZoom(1)}>Vừa chiều rộng</Button>
      <Button variant={doc.bookmarks.includes(page) ? "secondary" : "outline"} disabled={!pdf || busy} onClick={() => mutate({ bookmark: page, remove: doc.bookmarks.includes(page) })}>{doc.bookmarks.includes(page) ? "Bỏ đánh dấu" : "Đánh dấu trang"}</Button><Button className="lg:hidden" variant="outline" onClick={() => setSideOpen(v => !v)}>{sideOpen ? "Đóng ghi chú" : "Ghi chú & tìm kiếm"}</Button>
    </div>
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0 space-y-3">
        <div ref={viewport} onMouseUp={readSelection} onTouchEnd={readSelection} className="pdf-viewport min-w-0 max-w-full overflow-auto rounded-xl border bg-muted p-3" style={{ maxHeight: "78vh" }}>
          {!file ? <p role="status" className="p-8 text-center text-sm">Đang tải PDF… {Math.round(loadedBytes / initial.bytes * 100)}%</p> : <Document file={file} options={options} externalLinkTarget="_blank" externalLinkRel="noopener noreferrer" onLoadSuccess={p => { setPdf(p); const valid = Math.min(initial.page, p.numPages); setPage(valid); setPageInput(String(valid)) }} onLoadError={() => setError("Không mở được PDF. File có thể bị hỏng hoặc không được hỗ trợ.")} onPassword={(callback, reason) => { const password = window.prompt(reason === 2 ? "Mật khẩu chưa đúng. Nhập lại mật khẩu PDF:" : "PDF có mật khẩu. Nhập mật khẩu để đọc:"); if (password !== null) callback(password); else setError("Chưa mở PDF vì cần mật khẩu.") }} loading={<p className="p-8">Đang phân tích PDF…</p>}>
            <Page pageNumber={page} width={Math.min(width, 1200) * zoom} devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)} renderTextLayer renderAnnotationLayer loading={<p className="p-8">Đang vẽ trang…</p>} />
          </Document>}
        </div>
        <p className="text-xs text-muted-foreground">Bôi đen chữ trên trang để ghi chú hoặc tạo thẻ. PDF scan có thể không chọn/tìm được chữ; chưa có OCR.</p>
        {selection && <div className="space-y-2 rounded-xl border bg-card p-3"><p className="line-clamp-3 break-words text-sm">{selection}</p><div className="flex flex-wrap gap-2"><Button onClick={() => { setBack(selection); setSourcePage(page); setDraft(true); setSideOpen(true); requestId.current = null }}>Tạo flashcard từ đoạn chọn</Button><Button variant="outline" onClick={() => { setNote(selection.slice(0, 5000)); setNotePage(page); setSideOpen(true) }}>Ghi chú đoạn chọn</Button></div></div>}
      </section>
      <aside className={`${sideOpen ? "block" : "hidden"} min-w-0 space-y-5 rounded-xl border bg-card p-4 lg:block`}>
        <section className="space-y-2"><h2 className="font-semibold">Tìm trong PDF</h2><form className="flex gap-2" onSubmit={e => { e.preventDefault(); void search() }}><Input aria-label="Từ khóa trong PDF" value={query} onChange={e => { setQuery(e.target.value); searchGeneration.current++; setSearching(false); setSearched(false); setResults([]) }} /><Button disabled={!pdf || searching || !query.trim()}>Tìm</Button></form>{searching && <p role="status" className="text-xs">Đang tìm…</p>}{searched && <p className="text-xs text-muted-foreground">{results.length ? `${results.length} trang khớp (tối đa 100).` : "Không thấy kết quả. Nếu là bản scan, tài liệu cần OCR."}</p>}<div className="max-h-48 overflow-y-auto">{results.map(r => <button key={r.page} className="mb-2 block w-full rounded-lg p-2 text-left text-xs hover:bg-accent" onClick={() => navigate(r.page)}><strong>Trang {r.page}</strong><p className="break-words">{r.snippet}</p></button>)}</div></section>
        <section className="space-y-2 border-t pt-4"><h2 className="font-semibold">Trang đã đánh dấu</h2><div className="flex flex-wrap gap-2">{[...doc.bookmarks].sort((a, b) => a - b).map(p => <Button key={p} variant="outline" size="sm" onClick={() => navigate(p)}>Trang {p}</Button>)}</div>{!doc.bookmarks.length && <p className="text-xs text-muted-foreground">Chưa có dấu trang.</p>}</section>
        <section className="space-y-3 border-t pt-4"><h2 className="font-semibold">Ghi chú · trang {note ? notePage : page}</h2><textarea aria-label="Ghi chú tài liệu" value={note} onChange={e => { if (!note) setNotePage(page); setNote(e.target.value) }} disabled={busy} maxLength={5000} rows={4} className="w-full rounded-lg border bg-background p-3 text-sm" placeholder="Ý chính cần nhớ…" /><Button disabled={busy || !pdf || !note.trim()} onClick={async () => { if (await mutate({ note: { id: crypto.randomUUID(), page: notePage, text: note } })) setNote("") }}>Lưu ghi chú</Button><div className="max-h-80 space-y-3 overflow-y-auto">{doc.notes.map(n => <div key={n.id} className="rounded-lg border p-3"><button className="text-xs font-medium text-primary underline" onClick={() => navigate(n.page)}>Trang {n.page}</button><p className="mt-2 whitespace-pre-wrap break-words text-sm">{n.text}</p><Button variant="ghost" size="sm" disabled={busy} onClick={() => mutate({ deleteNote: n.id })}>Xóa ghi chú</Button></div>)}</div></section>
        <section className="space-y-3 border-t pt-4"><Button variant="outline" disabled={!pdf} onClick={() => { setDraft(v => !v); setSourcePage(page) }}>Tạo flashcard thủ công</Button>{draft && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void createCard() }}><p className="text-xs text-muted-foreground">Nguồn: {doc.title} · Trang {sourcePage}</p><label className="block text-sm">Bộ thẻ<select disabled={busy} required className="mt-1 w-full rounded-lg border bg-background p-2" value={deckId} onChange={e => { setDeckId(e.target.value); requestId.current = null }}><option value="">Chọn bộ thẻ</option>{decks.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}</select></label>{!decks.length && <Link href="/decks" className="text-sm underline">Tạo bộ thẻ trước</Link>}<label className="block text-sm">Câu hỏi<textarea disabled={busy} required maxLength={10000} value={front} onChange={e => { setFront(e.target.value); requestId.current = null }} className="mt-1 w-full rounded-lg border bg-background p-2" rows={3} /></label><label className="block text-sm">Đáp án<textarea disabled={busy} required maxLength={20000} value={back} onChange={e => { setBack(e.target.value); requestId.current = null }} className="mt-1 w-full rounded-lg border bg-background p-2" rows={5} /></label><Button disabled={busy || !deckId}>Lưu flashcard</Button></form>}</section>
      </aside>
    </div>
  </div>
}
