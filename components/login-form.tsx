"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { signIn, useSession } from "next-auth/react"

import beLan from "@/app/assets/beLan.jpg"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const router = useRouter()
  const { update } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = (formData.get("email") as string)?.trim()
    const password = formData.get("password") as string

    if (!email || !password) return

    try {
      setLoading(true)

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (!result || result.error) {
        setError("Email hoặc mật khẩu không đúng")
        return
      }

      await update()
      router.replace("/decks")
      router.refresh()
    } catch (err) {
      console.error(err)
      setError("Đã có lỗi xảy ra. Hãy thử lại sau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-[0_20px_60px_-40px_rgba(8,60,60,0.45)] backdrop-blur-lg">
      {/* 2 cột, cao tối thiểu để form và ảnh cân nhau */}
      <div className="grid min-h-[430px] md:grid-cols-[1.1fr,0.9fr]">
        {/* Cột form */}
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

        {/* Cột ảnh */}
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
