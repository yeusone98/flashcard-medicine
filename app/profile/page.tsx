// app/profile/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

export default function ProfilePage() {
    const { data: session, status, update } = useSession()
    const router = useRouter()
    const { toast } = useToast()

    const [file, setFile] = useState<File | null>(null)
    const [avatarLoading, setAvatarLoading] = useState(false)

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [profileLoading, setProfileLoading] = useState(false)

    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [passwordLoading, setPasswordLoading] = useState(false)

    const user = session?.user as
        | { name?: string | null; email?: string | null; image?: string | null }
        | undefined

    useEffect(() => {
        if (user) {
            setName(user.name || "")
            setEmail(user.email || "")
        }
    }, [user])

    const displayName = user?.name || user?.email || "Người dùng"
    const initials = (displayName || "?")
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

    const avatarSrc = user?.image || "/avatar-default.png"

    async function handleAvatarSubmit(e: React.FormEvent<HTMLFormElement>) {
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
            setAvatarLoading(true)
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
            setAvatarLoading(false)
        }
    }

    async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        try {
            setProfileLoading(true)

            const body: Record<string, string> = {}
            if (name.trim() !== (user?.name || "")) body.name = name.trim()
            if (email.trim() !== (user?.email || "")) body.email = email.trim()

            if (Object.keys(body).length === 0) {
                toast({ title: "Không có thay đổi" })
                return
            }

            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })

            const data = await res.json()
            if (!res.ok) {
                toast({
                    variant: "destructive",
                    title: "Cập nhật thất bại",
                    description: data.error || "Vui lòng thử lại.",
                })
                return
            }

            toast({ title: "Cập nhật hồ sơ thành công" })
            await update()
            router.refresh()
        } catch (err) {
            console.error(err)
            toast({
                variant: "destructive",
                title: "Lỗi",
                description: "Có lỗi xảy ra, vui lòng thử lại.",
            })
        } finally {
            setProfileLoading(false)
        }
    }

    async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        try {
            setPasswordLoading(true)

            const res = await fetch("/api/profile/password", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            })

            const data = await res.json()
            if (!res.ok) {
                toast({
                    variant: "destructive",
                    title: "Đổi mật khẩu thất bại",
                    description: data.error || "Vui lòng thử lại.",
                })
                return
            }

            toast({ title: "Đổi mật khẩu thành công" })
            setCurrentPassword("")
            setNewPassword("")
        } catch (err) {
            console.error(err)
            toast({
                variant: "destructive",
                title: "Lỗi",
                description: "Có lỗi xảy ra, vui lòng thử lại.",
            })
        } finally {
            setPasswordLoading(false)
        }
    }

    if (status === "loading") {
        return (
            <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center stagger">
                <p className="text-sm text-muted-foreground">Đang tải...</p>
            </main>
        )
    }

    if (!user) {
        return (
            <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center stagger">
                <p className="text-sm text-muted-foreground">
                    Bạn cần đăng nhập để xem trang này.
                </p>
            </main>
        )
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col gap-6 px-4 py-6 stagger">
            {/* Thông tin cá nhân */}
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

                    <Separator />

                    {/* Sửa thông tin */}
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Tên hiển thị</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nhập tên của bạn"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email"
                            />
                        </div>
                        <Button type="submit" disabled={profileLoading}>
                            {profileLoading ? "Đang lưu..." : "Lưu thay đổi"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Avatar */}
            <Card>
                <CardHeader>
                    <CardTitle>Ảnh đại diện</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAvatarSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="avatar">Chọn ảnh mới</Label>
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
                        <Button type="submit" disabled={avatarLoading}>
                            {avatarLoading ? "Đang upload..." : "Cập nhật avatar"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Đổi mật khẩu */}
            <Card>
                <CardHeader>
                    <CardTitle>Đổi mật khẩu</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                            <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Nhập mật khẩu hiện tại"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">Mật khẩu mới</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                            />
                        </div>
                        <Button type="submit" disabled={passwordLoading}>
                            {passwordLoading ? "Đang xử lý..." : "Đổi mật khẩu"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    )
}
