// lib/normalize.ts

export function normalizeImage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function normalizeTags(value: unknown): string[] | undefined {
  const raw =
    Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value.split(",")
        : []

  const tags = raw
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter((tag) => tag.length > 0)

  if (tags.length === 0) return undefined
  return Array.from(new Set(tags))
}

export function normalizeFields(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined
  const entries = Object.entries(value as Record<string, unknown>)
  const output: Record<string, string> = {}
  for (const [key, raw] of entries) {
    const trimmedKey = String(key || "").trim()
    if (!trimmedKey) continue
    output[trimmedKey] =
      typeof raw === "string"
        ? raw
        : raw === null || raw === undefined
          ? ""
          : String(raw)
  }
  return Object.keys(output).length > 0 ? output : undefined
}
