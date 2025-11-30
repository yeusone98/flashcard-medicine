// auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"

import { authConfig } from "./auth.config"
import { getUsersCollection, ObjectId } from "@/lib/mongodb"

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
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
            async authorize(
                credentials: Partial<Record<"email" | "password", unknown>>,
                _request: Request,
            ) {
                // ép kiểu lại cho dễ xài
                const emailRaw = credentials?.email as string | undefined
                const password = credentials?.password as string | undefined

                if (!emailRaw || !password) return null

                const email = emailRaw.toLowerCase().trim()

                const users = await getUsersCollection()
                const user = await users.findOne({ email })
                if (!user) return null

                const ok = await bcrypt.compare(password, user.password)
                if (!ok) return null

                // object trả về sẽ đi vào token + session.user
                return {
                    id: user._id!.toString(),
                    name: user.name ?? "",
                    email: user.email,
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = (user as any).id
            }
            return token
        },
        async session({ session, token }) {
            if (!session.user || !token.id) return session

            const userId = token.id as string
            const users = await getUsersCollection()
            const dbUser = await users.findOne({ _id: new ObjectId(userId) })

                ; (session.user as any).id = userId

            if (dbUser) {
                session.user.name = dbUser.name ?? session.user.name
                session.user.email = dbUser.email ?? session.user.email
                    ; (session.user as any).image = dbUser.image ?? null
            }

            return session
        },
    },
})
