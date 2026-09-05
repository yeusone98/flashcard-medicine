// lib/require-user.ts

import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function requireSession() {
    const session = await auth()
    if (!session || !session.user) {
        redirect("/login")
    }
    const userId = "id" in session.user && typeof session.user.id === "string" ? session.user.id : undefined
    if (!userId) {
        redirect("/login")
    }
    return { session, userId }
}

export async function requireUser() {
    const { session } = await requireSession()
    return session.user
}
