// proxy.ts
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const publicPaths = ["/login", "/register", "/api/auth", "/api/register"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow static files, Next.js internals, manifest, and public assets first
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|json|woff2?|webmanifest)$/)
  ) {
    return NextResponse.next()
  }

  // Fetch token once
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  const token = await getToken({ req, secret })

  // If user is already logged in and tries to visit login/register → redirect to /decks
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register")
  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL("/decks", req.url))
    }
    return NextResponse.next()
  }

  // Allow other public paths (api/auth, api/register)
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Protected routes — redirect to login if not authenticated
  if (!token) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
