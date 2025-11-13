// app/import/qa/page.tsx
'use client'

import { useState } from 'react'

export default function ImportQAPage() {
    const [file, setFile] = useState<File | null>(null)
    const [deckName, setDeckName] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) return

        setLoading(true)
        setMessage('')

        const formData = new FormData()
        formData.append('file', file)
        formData.append('deckName', deckName)

        const res = await fetch('/api/import/qa', {
            method: 'POST',
            body: formData,
        })
        const data = await res.json()
        setLoading(false)

        if (!res.ok) {
            setMessage(`Lỗi: ${data.error || 'Import thất bại'}`)
            return
        }

        setMessage(`Import thành công ${data.importedCount} thẻ!`)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900">
            <form
                onSubmit={handleSubmit}
                className="bg-slate-950 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 text-slate-100"
            >
                <h1 className="text-xl font-bold">Import Q/A từ Word (.docx)</h1>

                <div>
                    <label className="block text-sm mb-1">Tên deck</label>
                    <input
                        className="w-full px-3 py-2 rounded-md bg-slate-900 border border-slate-700 text-sm"
                        value={deckName}
                        onChange={e => setDeckName(e.target.value)}
                        placeholder="VD: Sinh lý – Huyết áp (Q/A)"
                    />
                </div>

                <div>
                    <label className="block text-sm mb-1">File .docx</label>
                    <input
                        type="file"
                        accept=".docx"
                        onChange={e => setFile(e.target.files?.[0] || null)}
                        className="w-full text-sm"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 rounded-md bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
                >
                    {loading ? 'Đang import...' : 'Import Q/A'}
                </button>

                {message && <div className="text-sm mt-2">{message}</div>}
            </form>
        </div>
    )
}
