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
      "Tạo một deck mới trong mục Môn học hoặc Decks.",
      "Thêm flashcard hoặc câu hỏi trắc nghiệm.",
      "Nhấn Học hôm nay để bắt đầu ôn tập theo phương pháp FSRS.",
    ],
  },
  {
    title: "Phím tắt (Keyboard Shortcuts)",
    icon: BookOpen,
    items: [
      "Cmd+K / Ctrl+K: Mở thanh tìm kiếm nhanh Deck.",
      "Flashcard: Phím Space để lật thẻ.",
      "Flashcard: Phím 1 (Lại), 2 (Khó), 3 (Tốt), 4 (Dễ).",
      "Trắc nghiệm: Phím 1, 2, 3, 4 chọn đáp án A, B, C, D.",
      "Trắc nghiệm: Phím Enter để nộp bài hoặc sang câu tiếp.",
    ],
  },
  {
    title: "Chia sẻ & Khám phá Deck",
    icon: Layers,
    items: [
      "Vào Deck > 'Bật chia sẻ công khai' để lấy link gửi bạn bè.",
      "Người có link có thể xem preview và Clone deck về tài khoản.",
      "Tìm deck hay từ cộng đồng trong mục 'Khám phá'.",
    ],
  },
  {
    title: "Quản lý & Bảo mật",
    icon: CheckCircle2,
    items: [
      "Dữ liệu của bạn hoàn toàn riêng tư, người khác không thể xem trừ khi bạn chia sẻ link.",
      "Đổi tên, avatar, mật khẩu bảo mật trong trang Profile.",
    ],
  },
  {
    title: "Import & Cài đặt App (PWA)",
    icon: FileDown,
    items: [
      "Copy đoạn text văn bản để AI tự động tạo Flashcard.",
      "Import từ file JSON, CSV (tương thích Anki cơ bản).",
      "Trên điện thoại (iOS Safari/Android Chrome): Chọn 'Thêm vào MH chính' (Add to Home Screen) để dùng web như một App thực thụ.",
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
