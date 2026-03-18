// components/login-form.tsx
"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"

import beLan from "@/app/assets/beLan.jpg"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

export function LoginForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = (formData.get("email") as string)?.trim()
    const password = formData.get("password") as string

    if (!email || !password) return

    setLoading(true)
    const res = await signIn("credentials", {
      redirect: false, // tự điều hướng bằng router
      email,
      password,
    })
    setLoading(false)

    if (res?.error) {
      setError("Email hoặc mật khẩu không đúng")
      return
    }

    // Đăng nhập thành công, dùng window.location.href để ép tải lại trang
    // giúp Auth.js nhận cookie session mới nhất trên production Vercel.
    window.location.href = "/decks"
  }

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-[0_20px_60px_-40px_rgba(8,60,60,0.45)] backdrop-blur-lg">
      {/* 2 cột, cao tối thiểu để form & ảnh cân nhau */}
      <div className="grid min-h-[430px] md:grid-cols-[1.1fr,0.9fr]">
        {/* CỘT FORM – căn giữa theo chiều dọc */}
        <CardContent className="flex flex-col justify-center gap-6 p-8 md:p-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Đăng nhập
            </h1>
            <p className="text-sm text-muted-foreground">
              Vào Flashcard Medicine để lưu tiến độ học và kết quả làm bài.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
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
                autoComplete="current-password"
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="h-11 w-full" disabled={loading}>
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Chưa có tài khoản?{" "}
              <Link href="/register" className="font-medium underline">
                Đăng ký
              </Link>
            </p>
          </form>
        </CardContent>

        {/* CỘT ẢNH – full viền, khớp card */}
        <div className="relative hidden md:block">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/25" />
          <Image
            src={beLan}
            alt="Lại Bùi Kim Lan"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>
    </Card>
  )
}
