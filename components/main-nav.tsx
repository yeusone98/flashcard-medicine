// components/main-nav.tsx
"use client"

import Link from "@/components/navigation-link"
import { usePathname } from "next/navigation"
import { Layers, LogOut, Menu, User as UserIcon } from "lucide-react"
import { useSession, signOut } from "next-auth/react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { CommandSearch } from "@/components/command-search"
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
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/deck-parents", label: "Môn học" },
  { href: "/explore", label: "Khám phá" },
  { href: "/import", label: "Nhập dữ liệu" },
  { href: "/media", label: "Thư viện" },
  { href: "/help", label: "Hướng dẫn" },
]

export function MainNav() {
  const pathname = usePathname()
  const { data: session, status } = useSession()

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

  const avatarSrc = user?.image || undefined

  return (
    <header data-main-nav className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl shadow-sm relative after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/40 after:to-transparent">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 md:gap-3 px-3 md:h-16 md:px-4">
        {/* Logo + tên app */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shadow-sm">
            <Layers className="h-4 w-4" />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight whitespace-nowrap md:block md:text-base">
            Flashcard Medicine
          </span>
        </Link>

        {/* Search Bar */}
        <div className="min-w-0 flex-1">
          <CommandSearch />
        </div>

        {/* Nav + user + toggle theme */}
        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          {/* Mobile dropdown navigation */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "h-11 w-11 xl:hidden",
                )}
                aria-label="Mở điều hướng"
              >
                <Menu className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Điều hướng</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {links.map((link) => {
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href)

                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}

                      className={cn(
                        "w-full cursor-pointer",
                        isActive && "font-semibold text-primary",
                      )}
                    >
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 text-sm font-medium xl:flex">
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
                      variant: isActive ? "secondary" : "ghost",
                      size: "sm",
                    }),
                    "px-2 text-[13px]",
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* User area */}
          {status === "loading" ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-xs shadow-sm hover:bg-accent/70 md:px-3">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={avatarSrc} alt={displayName} />
                    <AvatarFallback className="text-[11px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium 2xl:inline">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
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

          {/* Dark / light toggle */}
          <div className="ml-1">
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
