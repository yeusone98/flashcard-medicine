import NextAuth from "next-auth"

import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|json|woff2?|webmanifest)$).*)",
  ],
}
