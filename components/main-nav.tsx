// components/main-nav.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Layers, LogOut, User as UserIcon } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const links = [
    { href: "/", label: "Trang chủ" },
    { href: "/decks", label: "Bộ thẻ" },
    { href: "/import", label: "Import" },
]

export function MainNav() {
    const pathname = usePathname()
    const { data: session, status } = useSession()

    const user = session?.user as
        | { name?: string | null; email?: string | null; image?: string | null }
        | undefined

    const displayName = user?.name || user?.email || "Người dùng"

    // 2 ký tự đầu tên/email làm chữ avatar
    const initials = (displayName || "?")
        .split(/\s+/)
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()

    // Đường dẫn ảnh avatar:
    // - Nếu user.image có (sau này bạn lưu trong DB) → dùng user.image
    // - Nếu không → dùng /avatar-default.png trong thư mục /public
    const avatarSrc = user?.image || "/avatar-default.png"

    return (
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-3 md:h-16 md:px-4">
                {/* Logo + tên app */}
                <Link href="/" className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    <span className="text-sm font-semibold tracking-tight md:text-base">
                        Flashcard Medicine
                    </span>
                </Link>

                {/* Nav + user + toggle theme (toggle nằm CUỐI BÊN PHẢI) */}
                <div className="flex items-center gap-2 md:gap-3">
                    <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
                        {links.map((link) => {
                            const isActive =
                                link.href === "/"
                                    ? pathname === "/"
                                    : pathname.startsWith(link.href)

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        buttonVariants({
                                            variant: isActive ? "default" : "ghost",
                                            size: "sm",
                                        }),
                                        "px-2 md:px-3",
                                    )}
                                >
                                    {link.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User area (nằm TRƯỚC toggle) */}
                    {status === "loading" ? (
                        // Đang load session
                        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                    ) : user ? (
                        // Đã đăng nhập: avatar + tên + menu đăng xuất
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-xs hover:bg-accent md:px-3">
                                    <Avatar className="h-7 w-7">
                                        <AvatarImage src={avatarSrc} alt={displayName} />
                                        <AvatarFallback className="text-[11px]">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="hidden max-w-[140px] truncate text-sm font-medium md:inline">
                                        {displayName}
                                    </span>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel className="space-y-1">
                                    <p className="flex items-center gap-2 text-sm font-medium">
                                        <UserIcon className="h-4 w-4" />
                                        {displayName}
                                    </p>
                                    {user.email && (
                                        <p className="truncate text-xs text-muted-foreground">
                                            {user.email}
                                        </p>
                                    )}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                    <Link href="/profile" className="cursor-pointer">
                                        <UserIcon className="mr-2 h-4 w-4" />
                                        <span>Trang cá nhân</span>
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => signOut({ callbackUrl: "/login" })}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Đăng xuất</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        // Chưa đăng nhập
                        <Link
                            href="/login"
                            className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "px-3 text-xs md:text-sm",
                            )}
                        >
                            Đăng nhập
                        </Link>
                    )}

                    {/* Dark / light toggle – nằm cuối cùng bên phải */}
                    <div className="ml-1">
                        <ModeToggle />
                    </div>
                </div>
            </div>
        </header>
    )
}
