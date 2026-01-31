import Link from "next/link"
import { notFound } from "next/navigation"
import { Layers, BookOpenCheck, ListChecks, Pencil, Upload } from "lucide-react"

import { requireSession } from "@/lib/require-user"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  ObjectId,
} from "@/lib/mongodb"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default async function DeckOverviewPage(
  props: {
    params: Promise<{ deckId: string }>
    searchParams?: Promise<{ subject?: string }>
  },
) {
  await requireSession()

  const { deckId } = await props.params
  const searchParams = props.searchParams ? await props.searchParams : {}
  const subjectParam =
    typeof searchParams?.subject === "string" ? searchParams.subject : ""
  const subject = subjectParam.trim()

  if (!ObjectId.isValid(deckId)) {
    return notFound()
  }

  const _id = new ObjectId(deckId)
  const [decksCol, flashcardsCol, questionsCol] = await Promise.all([
    getDecksCollection(),
    getFlashcardsCollection(),
    getQuestionsCollection(),
  ])

  const [deck, flashcardCount, questionCount] = await Promise.all([
    decksCol.findOne({ _id }),
    flashcardsCol.countDocuments({ deckId: _id }),
    questionsCol.countDocuments({ deckId: _id }),
  ])

  if (!deck) {
    return notFound()
  }

  const decksHref = subject
    ? `/decks?subject=${encodeURIComponent(subject)}`
    : "/decks"

  const buildHref = (path: string, params?: Record<string, string>) => {
    const search = new URLSearchParams()
    if (subject) {
      search.set("subject", subject)
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) search.set(key, value)
      })
    }
    const query = search.toString()
    return query ? `${path}?${query}` : path
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 stagger">
      <nav className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Link href={decksHref} className="hover:text-foreground">
          Decks
        </Link>
        <span>/</span>
        <span className="text-foreground">{deck.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Layers className="h-3 w-3" />
            </span>
            <span>Deck overview</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {deck.name}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {deck.description && deck.description.trim().length > 0
              ? deck.description
              : "Chưa có mô tả cho deck này."}
          </p>
          {deck.subject ? (
            <Badge variant="outline" className="text-[11px] uppercase">
              {deck.subject}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={buildHref(`/decks/${deckId}/edit`)}>Edit set</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/import">
              <Upload className="mr-1 h-4 w-4" />
              Import thêm
            </Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flashcards</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {flashcardCount} thẻ trong bộ này
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={buildHref(`/decks/${deckId}/mcq`, { mode: "due" })}>
                <ListChecks className="mr-1 h-4 w-4" />
                Làm hôm nay
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={buildHref(`/decks/${deckId}/mcq`, { mode: "all" })}>
                Tất cả
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={buildHref(`/decks/${deckId}/mcq`, { mode: "mix" })}>
                Tổng ôn trộn đề
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chỉnh sửa nhanh</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Sửa, thêm, kéo thả thứ tự flashcards và MCQ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref(`/decks/${deckId}/edit`)}>
                <Pencil className="mr-1 h-4 w-4" />
                Mở Edit set
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
