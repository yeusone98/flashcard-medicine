// lib/require-user.ts

import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function requireSession() {
    const session = await auth()
    if (!session || !session.user) {
        redirect("/login")
    }
    return session
}

export async function requireUser() {
    const session = await requireSession()
    return session.user
}
