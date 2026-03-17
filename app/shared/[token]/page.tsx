// app/shared/[token]/page.tsx
import { notFound } from "next/navigation"
import Link from "next/link"
import {
  BookOpenCheck,
  BookOpen,
  ListChecks,
  Globe,
  Copy,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import SharedCloneButton from "./shared-clone-button"

type PreviewCard = {
  _id: string
  front: string
  tags: string[]
}

type SharedDeck = {
  id: string
  name: string
  description: string
  subject: string
  shareToken: string
  ownerName: string
  flashcardCount: number
  questionCount: number
  previewCards: PreviewCard[]
  updatedAt: string
}

export default async function SharedDeckPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const res = await fetch(
    `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/shared/${token}`,
    { cache: "no-store" },
  )

  if (!res.ok) return notFound()

  const deck: SharedDeck = await res.json()

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-8 stagger">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1 text-xs">
              <Globe className="h-3 w-3" />
              Deck công khai
            </Badge>
            {deck.subject && (
              <Badge variant="outline" className="text-xs">
                {deck.subject}
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {deck.name}
          </h1>
          {deck.description && (
            <p className="text-sm text-muted-foreground">{deck.description}</p>
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            Tác giả: <span className="font-medium text-foreground">{deck.ownerName}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <SharedCloneButton deckId={deck.id} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={undefined}
            id="copy-link-btn"
            data-share-url={`/shared/${token}`}
          >
            <Copy className="h-4 w-4" />
            Copy link
          </Button>
        </div>
      </div>

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <BookOpen className="h-8 w-8 text-primary/70" />
            <div>
              <p className="text-2xl font-bold">{deck.flashcardCount}</p>
              <p className="text-xs text-muted-foreground">Flashcards</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <ListChecks className="h-8 w-8 text-primary/70" />
            <div>
              <p className="text-2xl font-bold">{deck.questionCount}</p>
              <p className="text-xs text-muted-foreground">Câu MCQ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <BookOpenCheck className="h-8 w-8 text-primary/70" />
            <div>
              <p className="text-sm font-medium">Clone để học</p>
              <p className="text-xs text-muted-foreground">Thêm vào tài khoản của bạn</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Preview cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Xem trước flashcards ({deck.previewCards.length}/{deck.flashcardCount})
          </h2>
          {deck.flashcardCount > 50 && (
            <Badge variant="outline" className="text-xs">
              Hiển thị 50 thẻ đầu
            </Badge>
          )}
        </div>

        {deck.previewCards.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Deck này chưa có flashcard.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {deck.previewCards.map((card, i) => (
              <Card key={card._id} className="border-border/60">
                <CardHeader className="pb-2 pt-3">
                  <CardDescription className="text-[10px]">
                    #{i + 1}
                  </CardDescription>
                  <CardTitle
                    className="line-clamp-3 text-sm font-normal"
                    dangerouslySetInnerHTML={{ __html: card.front }}
                  />
                </CardHeader>
                {card.tags.length > 0 && (
                  <CardContent className="pb-3 pt-0">
                    <div className="flex flex-wrap gap-1">
                      {card.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <div className="border-t pt-4 text-center">
        <p className="mb-3 text-sm text-muted-foreground">
          Muốn học bộ thẻ này với hệ thống spaced repetition?
        </p>
        <SharedCloneButton deckId={deck.id} size="default" />
        <p className="mt-2 text-xs text-muted-foreground">
          Cần có tài khoản.{" "}
          <Link href="/register" className="underline hover:text-foreground">
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </main>
  )
}
