// app/login/actions.ts
"use server"

import { AuthError } from "next-auth"
import { signIn } from "@/auth"

export async function authenticate(
    _prevState: { error?: string } | undefined,
    formData: FormData,
): Promise<{ error?: string }> {
    try {
        // NextAuth sẽ đọc email, password, redirectTo từ FormData
        await signIn("credentials", formData)
        return {}
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Email hoặc mật khẩu không đúng" }
                default:
                    return { error: "Có lỗi xảy ra, vui lòng thử lại" }
            }
        }
        throw error
    }
}
