// components/login-form.tsx
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
        setError("Email hoáº·c máº­t kháº©u khÃ´ng Ä‘Ãºng")
        return
      }

      await update()
      router.replace("/decks")
      router.refresh()
    } catch (err) {
      console.error(err)
      setError("ÄÃ£ cÃ³ lá»—i xáº£y ra. HÃ£y thá»­ láº¡i sau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="overflow-hidden border-border/70 bg-card/90 shadow-[0_20px_60px_-40px_rgba(8,60,60,0.45)] backdrop-blur-lg">
      {/* 2 cá»™t, cao tá»‘i thiá»ƒu Ä‘á»ƒ form & áº£nh cÃ¢n nhau */}
      <div className="grid min-h-[430px] md:grid-cols-[1.1fr,0.9fr]">
        {/* Cá»˜T FORM â€“ cÄƒn giá»¯a theo chiá»u dá»c */}
        <CardContent className="flex flex-col justify-center gap-6 p-8 md:p-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              ÄÄƒng nháº­p
            </h1>
            <p className="text-sm text-muted-foreground">
              VÃ o Flashcard Medicine Ä‘á»ƒ lÆ°u tiáº¿n Ä‘á»™ há»c vÃ  káº¿t quáº£ lÃ m bÃ i.
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
              <Label htmlFor="password">Máº­t kháº©u</Label>
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
              {loading ? "Äang Ä‘Äƒng nháº­p..." : "ÄÄƒng nháº­p"}
            </Button>

            <p className="text-xs text-muted-foreground">
              ChÆ°a cÃ³ tÃ i khoáº£n?{" "}
              <Link href="/register" className="font-medium underline">
                ÄÄƒng kÃ½
              </Link>
            </p>
          </form>
        </CardContent>

        {/* Cá»˜T áº¢NH â€“ full viá»n, khá»›p card */}
        <div className="relative hidden md:block">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/25" />
          <Image
            src={beLan}
            alt="Láº¡i BÃ¹i Kim Lan"
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>
    </Card>
  )
}
