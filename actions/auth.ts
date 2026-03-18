"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginAction(formData: FormData) {
  try {
    const data = Object.fromEntries(formData)
    await signIn("credentials", { ...data, redirectTo: "/decks" })
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return { error: "Email hoặc mật khẩu không đúng" }
      }
      return { error: "Đã có lỗi xảy ra. Hãy thử lại sau." }
    }
    // NEXT_REDIRECT error must be thrown for Next.js redirect to work
    throw error
  }
}
