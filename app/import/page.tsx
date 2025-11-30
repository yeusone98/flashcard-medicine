// app/import/page.tsx
import Link from "next/link"
import { ArrowRight, FileText, HelpCircle, ListChecks } from "lucide-react"
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
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-8">
            <section className="space-y-2">
                <Badge variant="outline" className="text-xs">
                    Import dữ liệu
                </Badge>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                    Chọn cách import dữ liệu vào Flashcard Medicine
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    Bạn có thể import từ file .docx theo 3 định dạng: Cloze, Q/A hoặc
                    Trắc nghiệm (MCQ). Mỗi lần import sẽ tạo một deck mới với mô tả riêng.
                </p>
            </section>

            <Card>
                <CardHeader>
                    <CardTitle>Import từ JSON (tự tạo)</CardTitle>
                    <CardDescription>
                        Dán JSON flashcard + câu hỏi (do bạn hoặc ChatGPT tạo) để sinh deck mới.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild variant="outline" size="sm">
                        <Link href="/import/manual-json">Mở form JSON</Link>
                    </Button>
                </CardFooter>
            </Card>


            <section className="grid gap-4 md:grid-cols-3">
                {/* Cloze */}
                <Card className="flex h-full flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <FileText className="h-4 w-4" />
                            </span>
                            Cloze
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                            Đoạn văn có chỗ trống {"{{ }}"} sẽ được tách thành flashcard Cloze.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 text-xs text-muted-foreground">
                        <p>Phù hợp để:</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            <li>Học khái niệm, định nghĩa, số liệu</li>
                            <li>Ôn theo ngữ cảnh dài</li>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button asChild size="sm" className="w-full justify-between">
                            <Link href="/import/cloze">
                                Import Cloze
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>

                {/* Q/A */}
                <Card className="flex h-full flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <HelpCircle className="h-4 w-4" />
                            </span>
                            Q / A
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                            Định dạng hỏi – đáp: Q: câu hỏi, A: câu trả lời → flashcard Q/A.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 text-xs text-muted-foreground">
                        <p>Phù hợp để:</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            <li>Luyện nhớ câu hỏi ôn tập</li>
                            <li>Chuẩn bị cho thi vấn đáp</li>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button asChild size="sm" className="w-full justify-between">
                            <Link href="/import/qa">
                                Import Q/A
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Generate từ ghi chú (AI)</CardTitle>
                        <CardDescription>
                            Dán nội dung Markdown/Notion, hệ thống tự tạo flashcard và câu hỏi trắc nghiệm.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button asChild variant="outline" size="sm">
                            <Link href="/import/notes-ai">Mở trình tạo từ notes</Link>
                        </Button>
                    </CardFooter>
                </Card>

                {/* MCQ */}
                <Card className="flex h-full flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <ListChecks className="h-4 w-4" />
                            </span>
                            Trắc nghiệm (MCQ)
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm">
                            Định dạng Q: / A: / Correct: → câu hỏi trắc nghiệm kèm đáp án.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 text-xs text-muted-foreground">
                        <p>Phù hợp để:</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4">
                            <li>Làm bài test nhanh</li>
                            <li>Thực hành đề thi trắc nghiệm</li>
                        </ul>
                    </CardContent>
                    <CardFooter>
                        <Button
                            asChild
                            size="sm"
                            className="w-full justify-between"
                            variant="outline"
                        >
                            <Link href="/import/mcq">
                                Import MCQ
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </section>
        </main>
    )
}
