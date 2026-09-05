// app/login/page.tsx
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <main className="auth-shell relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10 stagger">
      {/* lớp ánh sáng xanh cho đẹp */}
      <div className="relative w-full max-w-5xl">
        <LoginForm />
      </div>
    </main>
  )
}
