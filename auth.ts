// auth.ts
import NextAuth from "next-auth"
import type { Session } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"
import bcrypt from "bcryptjs"

import { authConfig } from "./auth.config"
import { getUsersCollection } from "@/lib/mongodb"

type AppJWT = JWT & {
    id?: string
}

type SessionUserWithId = NonNullable<Session["user"]> & {
    id?: string
}

type SessionUpdatePayload = {
    name?: string | null
    email?: string | null
    image?: string | null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    trustHost: true,
    session: {
        strategy: "jwt",
    },
    providers: [
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                // Ép kiểu an toàn
                const email =
                    typeof credentials?.email === "string"
                        ? credentials.email.toLowerCase().trim()
                        : undefined
                const password =
                    typeof credentials?.password === "string"
                        ? credentials.password
                        : undefined

                if (!email || !password) {
                    return null
                }

                const users = await getUsersCollection()
                const user = await users.findOne({ email })

                // ✅ Check luôn user.password để TS biết chắc là string
                if (!user || !user.password) {
                    return null
                }

                const ok = await bcrypt.compare(password, user.password)
                if (!ok) return null

                // object trả về sẽ đi vào token + session.user
                return {
                    id: user._id?.toString() ?? "",
                    name: user.name ?? "",
                    email: user.email,
                    image: user.image ?? null,
                }
            },
        }),
    ],
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user, trigger, session }) {
            if (user) {
                // Lưu toàn bộ thông tin cần thiết vào JWT để tránh query DB ở mỗi lần đọc session.
                ; (token as AppJWT).id = user.id
                token.name = user.name
                token.email = user.email
                token.picture = user.image ?? null
            }

            if (trigger === "update") {
                const sessionUpdate = session as SessionUpdatePayload | undefined

                if (sessionUpdate && "name" in sessionUpdate) {
                    token.name = sessionUpdate.name ?? null
                }
                if (sessionUpdate && "email" in sessionUpdate) {
                    token.email = sessionUpdate.email ?? null
                }
                if (sessionUpdate && "image" in sessionUpdate) {
                    token.picture = sessionUpdate.image ?? null
                }
            }

            return token
        },
        async session({ session, token }) {
            if (!session.user) return session

            const userId = (token as AppJWT).id
            if (!userId) return session

            const sessionUser = session.user as SessionUserWithId
            sessionUser.id = userId
            session.user.name = typeof token.name === "string" ? token.name : null
            if (typeof token.email === "string") {
                session.user.email = token.email
            }
            sessionUser.image = typeof token.picture === "string" ? token.picture : null

            return session
        },
    },
})
