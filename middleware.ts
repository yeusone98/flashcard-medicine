// middleware.ts
import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

const publicPaths = ["/login", "/register", "/api/auth", "/api/register"]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|gif|css|js|woff2?)$/)
  ) {
    return NextResponse.next()
  }

  // Check for JWT token — pass secret explicitly for edge runtime
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  const token = await getToken({ req, secret })

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
