// app/login/page.tsx
import { LoginForm } from "@/components/login-form"

export default function LoginPage() {
  return (
    <main className="auth-shell relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10 stagger">
      {/* lớp ánh sáng xanh cho đẹp */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,#0ea5a42b,transparent_60%),radial-gradient(circle_at_100%_100%,#0ea5a42b,transparent_55%)]" />
      <div className="relative w-full max-w-5xl">
        <LoginForm />
      </div>
    </main>
  )
}
