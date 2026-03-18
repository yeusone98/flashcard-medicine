// auth.config.ts
import type { NextAuthConfig } from "next-auth"

const authPages = new Set(["/login", "/register"])

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isAuthPage = authPages.has(nextUrl.pathname)

            if (isAuthPage) {
                if (!isLoggedIn) return true

                const callbackUrl = nextUrl.searchParams.get("callbackUrl")
                const redirectPath =
                    callbackUrl &&
                    callbackUrl.startsWith("/") &&
                    !callbackUrl.startsWith("//")
                        ? callbackUrl
                        : "/decks"

                return Response.redirect(new URL(redirectPath, nextUrl))
            }

            return isLoggedIn
        },
    },
    providers: [],
} satisfies NextAuthConfig
