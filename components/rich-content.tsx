"use client"

import { useMemo } from "react"
import DOMPurify from "dompurify"
import { MathJax, MathJaxContext } from "better-react-mathjax"

import { cn } from "@/lib/utils"

type RichContentTag = "div" | "span" | "p"

interface RichContentProps {
  content?: string | null
  fields?: Record<string, string> | null
  revealCloze?: boolean
  className?: string
  as?: RichContentTag
}

const MATHJAX_CONFIG = {
  tex: {
    inlineMath: [["$", "$"], ["\\(", "\\)"]],
    displayMath: [["$$", "$$"], ["\\[", "\\]"]],
    processEscapes: true,
  },
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
}

const FIELD_REGEX = /\{\{\s*field:([a-zA-Z0-9_-]+)\s*\}\}/g
const CLOZE_REGEX =
  /\{\{c(\d+)::([\s\S]+?)(?:::([\s\S]+?))?\}\}/gi
const LEGACY_CLOZE_REGEX = /\{\{(?!\s*(?:c\d+::|field:))([\s\S]+?)\}\}/g

const replaceFields = (
  input: string,
  fields: Record<string, string> | null | undefined,
  forHtml: boolean,
) => {
  if (!fields || Object.keys(fields).length === 0) return input
  return input.replace(FIELD_REGEX, (_match, rawKey) => {
    const key = String(rawKey || "").trim()
    if (!key) return ""
    const value = fields[key]
    if (value === undefined) {
      return forHtml
        ? `<span class="field-missing">[field:${key}]</span>`
        : `[field:${key}]`
    }
    return String(value)
  })
}

const applyCloze = (input: string, reveal: boolean, forHtml: boolean) => {
  let output = input
  output = output.replace(
    CLOZE_REGEX,
    (_match, rawIndex, rawAnswer, rawHint) => {
      const index = String(rawIndex || "").trim()
      const answer = String(rawAnswer || "").trim()
      const hint = String(rawHint || "").trim()
      if (reveal) {
        return forHtml
          ? `<span class="cloze-answer" data-cloze="${index}">${answer}</span>`
          : answer
      }
      const blank = hint ? hint : "____"
      return forHtml
        ? `<span class="cloze-blank" data-cloze="${index}">${blank}</span>`
        : blank
    },
  )

  output = output.replace(LEGACY_CLOZE_REGEX, (_match, rawAnswer) => {
    const answer = String(rawAnswer || "").trim()
    if (reveal) {
      return forHtml
        ? `<span class="cloze-answer" data-cloze="legacy">${answer}</span>`
        : answer
    }
    return forHtml
      ? `<span class="cloze-blank" data-cloze="legacy">____</span>`
      : "____"
  })

  return output
}

const toHtml = (input: string) =>
  input.replace(/\r\n/g, "\n").replace(/\n/g, "<br/>")

const sanitizeHtml = (html: string) =>
  DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["audio", "source"],
    ADD_ATTR: [
      "class",
      "data-cloze",
      "target",
      "rel",
      "controls",
      "src",
      "type",
      "preload",
      "autoplay",
      "loop",
      "muted",
    ],
  })

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

export default function RichContent({
  content,
  fields,
  revealCloze = false,
  className,
  as = "div",
}: RichContentProps) {
  const raw = typeof content === "string" ? content : ""

  const prepared = useMemo(() => {
    const withFields = replaceFields(raw, fields, true)
    return applyCloze(withFields, revealCloze, true)
  }, [fields, raw, revealCloze])

  const preparedPlain = useMemo(() => {
    const withFields = replaceFields(raw, fields, false)
    return applyCloze(withFields, revealCloze, false)
  }, [fields, raw, revealCloze])

  const html = useMemo(() => toHtml(prepared), [prepared])
  const fallbackHtml = useMemo(
    () => toHtml(escapeHtml(preparedPlain)),
    [preparedPlain],
  )

  const sanitized = useMemo(() => {
    if (typeof window === "undefined") return fallbackHtml
    return sanitizeHtml(html)
  }, [fallbackHtml, html])

  const Element = as

  return (
    <MathJaxContext config={MATHJAX_CONFIG}>
      <MathJax dynamic>
        <Element
          className={cn("rich-content", className)}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </MathJax>
    </MathJaxContext>
  )
}
