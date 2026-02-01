// app/help/page.tsx
import Link from "next/link"
import {
  BookOpen,
  CheckCircle2,
  FileDown,
  Layers,
  LifeBuoy,
  Sparkles,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { requireSession } from "@/lib/require-user"

const sections = [
  {
    title: "Bắt đầu nhanh",
    icon: Sparkles,
    items: [
      "Tạo một deck mới trong mục Decks.",
      "Thêm flashcard hoặc câu hỏi trắc nghiệm.",
      "Nhấn học để bắt đầu ôn tập.",
    ],
  },
  {
    title: "Tạo & quản lý deck",
    icon: Layers,
    items: [
      "Đặt tên, môn học, mô tả để dễ tìm.",
      "Sắp xếp thứ tự thẻ bằng kéo thả.",
      "Gắn tag để lọc nhanh.",
    ],
  },
  {
    title: "Học flashcard",
    icon: BookOpen,
    items: [
      "Nhấn Space hoặc click để lật thẻ.",
      "Đánh giá mức độ nhớ: Khó / TB / Dễ.",
      "Lọc chỉ thẻ khó khi cần ôn gấp.",
    ],
  },
  {
    title: "Làm MCQ",
    icon: CheckCircle2,
    items: [
      "Chọn đáp án và nộp để xem kết quả.",
      "Xem giải thích để hiểu sâu hơn.",
      "Theo dõi điểm gần nhất trong deck.",
    ],
  },
  {
    title: "Import dữ liệu",
    icon: FileDown,
    items: [
      "Import JSON hoặc các nguồn hỗ trợ.",
      "Kiểm tra trước khi lưu.",
      "Sử dụng template để import nhanh.",
    ],
  },
]

export default async function HelpPage() {
  await requireSession()

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-8 stagger">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="outline" className="text-[11px]">
            Hướng dẫn sử dụng
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Học hiệu quả với Flashcard Medicine
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
            Trang này hướng dẫn các bước cơ bản để tạo deck, học flashcard, làm
            MCQ và import dữ liệu. Chỉ cần 5 phút là bạn bắt đầu được ngay.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/decks">Đi tới Decks</Link>
        </Button>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <Card key={section.title} className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <ul className="list-disc space-y-1 pl-5">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LifeBuoy className="h-4 w-4" />
            </span>
            Cần thêm trợ giúp?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Nếu bạn gặp lỗi dữ liệu hoặc cần hỗ trợ nâng cao, hãy kiểm tra lại
          kết nối, làm mới trang và thử lại. Bạn cũng có thể tạo một deck mẫu
          để thử nghiệm trước khi nhập dữ liệu lớn.
        </CardContent>
      </Card>
    </main>
  )
}
