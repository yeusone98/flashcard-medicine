// auth.ts
import NextAuth from "next-auth"
import type { Session } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"
import bcrypt from "bcryptjs"

import { authConfig } from "./auth.config"
import { getUsersCollection, ObjectId } from "@/lib/mongodb"

type AppJWT = JWT & {
    id?: string
}

type SessionUserWithId = NonNullable<Session["user"]> & {
    id?: string
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
        async jwt({ token, user }) {
            if (user) {
                // lưu id user vào token
                ; (token as AppJWT).id = user.id
            }
            return token
        },
        async session({ session, token }) {
            if (!session.user) return session

            const userId = (token as AppJWT).id
            if (!userId) return session

            const users = await getUsersCollection()
            const dbUser = await users.findOne({ _id: new ObjectId(userId) })

            const sessionUser = session.user as SessionUserWithId
            sessionUser.id = userId

            if (dbUser) {
                session.user.name = dbUser.name ?? session.user.name
                session.user.email = dbUser.email ?? session.user.email
                sessionUser.image = dbUser.image ?? sessionUser.image ?? null
            }

            return session
        },
    },
})
