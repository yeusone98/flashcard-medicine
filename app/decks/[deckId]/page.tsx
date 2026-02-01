import Link from "next/link"
import { notFound } from "next/navigation"
import { BookOpenCheck, ListChecks, Pencil, Upload } from "lucide-react"

import { requireSession } from "@/lib/require-user"
import {
  getDecksCollection,
  getFlashcardsCollection,
  getQuestionsCollection,
  ObjectId,
} from "@/lib/mongodb"
import { normalizeDeckOptions } from "@/lib/fsrs"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import DeckHeaderClient from "./deck-header-client"
import DeckOptionsClient from "./deck-options-client"

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

  const deckOptions = normalizeDeckOptions(deck.options ?? null)

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
        <DeckHeaderClient
          deckId={deckId}
          name={deck.name}
          description={deck.description ?? ""}
          subject={deck.subject ?? ""}
        />

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

        <DeckOptionsClient deckId={deckId} initialOptions={deckOptions} />
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
