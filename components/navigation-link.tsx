"use client"

import { forwardRef, type ComponentProps } from "react"
import Link, { useLinkStatus } from "next/link"
import { cn } from "@/lib/utils"

function NavigationPending() {
  const { pending } = useLinkStatus()
  if (!pending) return null

  // Route-level loading UI handles the visual response. Keeping this status
  // screen-reader-only avoids drawing an underline outside rounded buttons.
  return <span role="status" className="sr-only">Đang chuyển trang…</span>
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
