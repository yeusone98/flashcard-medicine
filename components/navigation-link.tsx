"use client"

import { forwardRef, type ComponentProps } from "react"
import Link, { useLinkStatus } from "next/link"
import { cn } from "@/lib/utils"

function NavigationPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null

  return (
    <span role="status" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none">
      <span className="sr-only">Đang chuyển trang…</span>
    </span>
  )
}

// Keep Next's navigation semantics (including modified clicks and cancellation).
const NavigationLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(
  ({ children, className, ...props }, ref) => (
    <Link ref={ref} className={cn("relative", className)} {...props}>
      {children}
      <NavigationPending />
    </Link>
  ),
)
NavigationLink.displayName = "NavigationLink"

export default NavigationLink
