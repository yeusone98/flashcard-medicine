import Link from "next/link"
import { ArrowRight, BookOpenCheck, ListChecks } from "lucide-react"

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { requireSession } from "@/lib/require-user"

export default async function ImportHubPage() {
  await requireSession()

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-8 stagger">
      <section className="space-y-2">
        <Badge variant="outline" className="text-xs">
          Import dữ liệu
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Import Flashcard và MCQ
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mỗi loại đều có 2 cách: tạo thủ công ngay trên trang import (giống
          Edit set), hoặc import JSON.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BookOpenCheck className="h-4 w-4" />
              </span>
              Import Flashcard
            </CardTitle>
            <CardDescription>
              Bắt buộc chọn môn học và bộ thẻ trước khi tạo flashcard.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Cách 1: Tạo thủ công giống Edit set</li>
              <li>Cách 2: Import JSON flashcard</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full justify-between">
              <Link href="/import/flashcard">
                Mở import Flashcard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ListChecks className="h-4 w-4" />
              </span>
              Import MCQ
            </CardTitle>
            <CardDescription>
              Bắt buộc chọn môn học và bộ thẻ trước khi tạo MCQ.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Cách 1: Tạo thủ công giống Edit set</li>
              <li>Cách 2: Import JSON MCQ</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full justify-between" variant="outline">
              <Link href="/import/mcq">
                Mở import MCQ
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </section>
    </main>
  )
}
