// components/main-nav.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Layers } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

const links = [
    { href: "/", label: "Trang chủ" },
    { href: "/decks", label: "Bộ thẻ" },
    { href: "/import", label: "Import" },
]

export function MainNav() {
    const pathname = usePathname()

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

                {/* Nav + toggle theme */}
                <div className="flex items-center gap-1 md:gap-2">
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
                                        "px-2 md:px-3"
                                    )}
                                >
                                    {link.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Dark / light toggle */}
                    <div className="ml-1">
                        <ModeToggle />
                    </div>
                </div>
            </div>
        </header>
    )
}
