// app/register/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export default function RegisterPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)

        const formData = new FormData(e.currentTarget)
        const name = formData.get("name") as string
        const email = formData.get("email") as string
        const password = formData.get("password") as string

        try {
            setLoading(true)
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error ?? "Đăng ký thất bại")
                return
            }

            toast({
                title: "Đăng ký thành công",
                description: "Bạn có thể đăng nhập ngay bây giờ.",
            })

            router.push("/login")
        } catch (err) {
            console.error(err)
            setError("Có lỗi xảy ra, vui lòng thử lại")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[#020617] px-4 py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,#22c55e22,transparent_60%),radial-gradient(circle_at_100%_100%,#22c55e22,transparent_55%)]" />
            <div className="relative w-full max-w-xl">
                <Card className="border border-slate-800/70 bg-slate-950/85 shadow-2xl shadow-black/60 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl">Đăng ký</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Tên hiển thị</Label>
                                <Input id="name" name="name" placeholder="Nguyễn Văn A" />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    placeholder="@gmail.com"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Mật khẩu</Label>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    minLength={6}
                                />
                            </div>

                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}

                            <Button type="submit" className="h-11 w-full" disabled={loading}>
                                {loading ? "Đang đăng ký..." : "Tạo tài khoản"}
                            </Button>
                        </form>

                        <p className="text-center text-xs text-muted-foreground">
                            Đã có tài khoản?{" "}
                            <Link href="/login" className="underline">
                                Đăng nhập
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
