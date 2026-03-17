// lib/auth-helpers.ts
import { NextResponse } from "next/server"
import type { Session } from "next-auth"
import { auth } from "@/auth"

export function getUserIdFromSession(
    session: Session | null,
): string | undefined {
    if (!session?.user) return undefined
    if ("id" in session.user && typeof session.user.id === "string") {
        return session.user.id
    }
    return undefined
}

export type AuthResult = {
    userId: string
    session: Session
}

/**
 * Require an authenticated user. Returns { userId, session } or a 401 NextResponse.
 * Usage:
 *   const authResult = await requireAuth()
 *   if (authResult instanceof NextResponse) return authResult
 *   const { userId, session } = authResult
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
    const session = await auth()
    const userId = getUserIdFromSession(session)

    if (!userId || !session) {
        return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    return { userId, session }
}
