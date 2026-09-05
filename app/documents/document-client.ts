export interface DocumentInfo {
  id: string; title: string; subject: string; status: "pending" | "ready"; bytes: number;
  page: number; bookmarks: number[]; notes: { id: string; page: number; text: string }[]
}
export async function documentRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(body?.error || "Không kết nối được. Vui lòng thử lại.")
  return body as T
}
