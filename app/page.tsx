// app/page.tsx
import Link from "next/link"
import { ArrowRight, Layers, Upload, LifeBuoy } from "lucide-react"
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

export default async function HomePage() {
    await requireSession()
    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-8 px-4 py-10 stagger">
            {/* Header */}
            <section className="space-y-3">
                <Badge variant="outline" className="text-xs">
                    Flashcard Medicine
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    Ôn thi Y khoa với{" "}
                    <span className="text-primary">Flashcard &amp; Trắc nghiệm</span>
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                    Tạo bộ thẻ, làm bài trắc nghiệm, xem lại sai – tất cả trong một nơi.
                    Chọn một hành động bên dưới để bắt đầu.
                </p>
            </section>

            {/* 2 cards chính */}
            <section className="grid gap-4 md:grid-cols-2">
                {/* Card DECKS */}
                <Link href="/decks" className="group">
                    <Card className="flex h-full flex-col border border-border/70 bg-gradient-to-b from-background/60 to-background/20 transition-transform duration-150 group-hover:-translate-y-1 group-hover:border-primary/60">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Layers className="h-4 w-4" />
                                    </span>
                                    Học &amp; quản lý bộ thẻ
                                </CardTitle>
                                <CardDescription className="mt-2 text-xs md:text-sm">
                                    Xem danh sách deck, học flashcard theo từng bộ, làm trắc
                                    nghiệm và xem lại kết quả.
                                </CardDescription>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-2 text-xs text-muted-foreground md:text-sm">
                            <ul className="list-disc space-y-1 pl-5">
                                <li>Học flashcard với hiệu ứng lật giống Quizlet</li>
                                <li>Làm bài MCQ, tính điểm /10 và xem giải thích</li>
                                <li>Đánh dấu câu đã thuộc / cần học lại</li>
                            </ul>
                        </CardContent>

                        <CardFooter className="mt-auto flex items-center justify-between pt-2">
                            <span className="text-[11px] text-muted-foreground">
                                Đi đến trang <span className="font-medium">Decks</span>
                            </span>
                            <Button size="sm" className="gap-1">
                                Vào decks
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                </Link>

                {/* Card IMPORT */}
                <Link href="/import" className="group">
                    <Card className="flex h-full flex-col border border-border/70 bg-gradient-to-b from-background/60 to-background/20 transition-transform duration-150 group-hover:-translate-y-1 group-hover:border-primary/60">
                        <CardHeader className="flex flex-row items-start justify-between gap-3">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Upload className="h-4 w-4" />
                                    </span>
                                    Import dữ liệu
                                </CardTitle>
                                <CardDescription className="mt-2 text-xs md:text-sm">
                                    Import Flashcard &amp; câu hỏi MCQ từ file JSON hoặc các nguồn
                                    khác vào hệ thống.
                                </CardDescription>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-2 text-xs text-muted-foreground md:text-sm">
                            <ul className="list-disc space-y-1 pl-5">
                                <li>Thêm nhanh hàng loạt flashcard cho từng deck</li>
                                <li>Import câu hỏi trắc nghiệm kèm đáp án &amp; giải thích</li>
                                <li>Chuẩn bị dữ liệu cho cả học lẫn kiểm tra</li>
                            </ul>
                        </CardContent>

                        <CardFooter className="mt-auto flex items-center justify-between pt-2">
                            <span className="text-[11px] text-muted-foreground">
                                Đi đến trang <span className="font-medium">Import</span>
                            </span>
                            <Button size="sm" variant="outline" className="gap-1">
                                Mở import
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </CardFooter>
                    </Card>
                </Link>
            </section>

            <section>
                <Card className="flex flex-col border border-border/70 bg-gradient-to-r from-background/70 to-background/30">
                    <CardHeader className="flex flex-row items-center justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <LifeBuoy className="h-4 w-4" />
                                </span>
                                Cần hướng dẫn nhanh?
                            </CardTitle>
                            <CardDescription className="mt-2 text-xs md:text-sm">
                                Xem hướng dẫn từng bước để tạo deck, học flashcard, làm MCQ và import dữ liệu.
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardFooter className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-[11px] text-muted-foreground">
                            Xem trang <span className="font-medium">Hướng dẫn</span>
                        </span>
                        <Button asChild size="sm" variant="outline" className="gap-1">
                            <Link href="/help">
                                Mở hướng dẫn
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </section>
        </main>
    )
}
