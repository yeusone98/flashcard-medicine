"use client"
import dynamic from "next/dynamic"
import type { DocumentInfo } from "../document-client"
const Reader = dynamic(() => import("./reader-client"), { ssr: false, loading: () => <p role="status" className="p-6">Đang mở trình đọc PDF…</p> })
export default function ReaderLoader({ document }: { document: DocumentInfo }) { return <Reader document={document} /> }
