// app/profile/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"

export default function ProfilePage() {
    const { data: session, status, update } = useSession()
    const router = useRouter()
    const { toast } = useToast()
    const [file, setFile] = useState<File | null>(null)
    const [loading, setLoading] = useState(false)

    const user = session?.user as
        | { name?: string | null; email?: string | null; image?: string | null }
        | undefined

    const displayName = user?.name || user?.email || "Người dùng"
    const initials = (displayName || "?")
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

    const avatarSrc = user?.image || "/avatar-default.png"

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!file) {
            toast({
                variant: "destructive",
                title: "Chưa chọn ảnh",
                description: "Vui lòng chọn một file ảnh để upload.",
            })
            return
        }

        try {
            setLoading(true)
            const formData = new FormData()
            formData.append("file", file)

            const res = await fetch("/api/profile/avatar", {
                method: "POST",
                body: formData,
            })

            const data = await res.json()
            if (!res.ok) {
                toast({
                    variant: "destructive",
                    title: "Upload thất bại",
                    description: data.error || "Vui lòng thử lại.",
                })
                return
            }

            toast({
                title: "Cập nhật avatar thành công",
                description: "Ảnh đại diện mới đã được lưu.",
            })

            // 🔥 Refresh session để navbar & profile dùng image mới
            await update()
            router.refresh()
        } catch (err) {
            console.error(err)
            toast({
                variant: "destructive",
                title: "Lỗi upload",
                description: "Có lỗi xảy ra, vui lòng thử lại.",
            })
        } finally {
            setLoading(false)
        }
    }


    if (status === "loading") {
        return (
            <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <p className="text-sm text-muted-foreground">Đang tải...</p>
            </main>
        )
    }

    if (!user) {
        return (
            <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <p className="text-sm text-muted-foreground">
                    Bạn cần đăng nhập để xem trang này.
                </p>
            </main>
        )
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col gap-6 px-4 py-6">
            <Card>
                <CardHeader>
                    <CardTitle>Hồ sơ cá nhân</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={avatarSrc} alt={displayName} />
                            <AvatarFallback className="text-lg">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-sm font-medium">{displayName}</p>
                            {user.email && (
                                <p className="text-xs text-muted-foreground">
                                    {user.email}
                                </p>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="avatar">Ảnh đại diện</Label>
                            <Input
                                id="avatar"
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    if (f) setFile(f)
                                }}
                            />
                            <p className="text-xs text-muted-foreground">
                                Chấp nhận file hình ảnh (tối đa 2MB).
                            </p>
                        </div>

                        <Button type="submit" disabled={loading}>
                            {loading ? "Đang upload..." : "Cập nhật avatar"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
