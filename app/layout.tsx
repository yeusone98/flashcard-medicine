// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNav } from "@/components/main-nav"
import { Toaster } from "@/components/ui/toaster"
import { AuthSessionProvider } from "@/components/auth-session-provider" // 👈 thêm

export const metadata: Metadata = {
    title: "Flashcard Medicine",
    description: "Flashcard & MCQ cho sinh viên Y",
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="min-h-screen bg-background text-foreground antialiased">
                <AuthSessionProvider>
                    <ThemeProvider>
                        <div className="flex min-h-screen flex-col">
                            <MainNav />
                            <main className="flex-1">{children}</main>
                            <Toaster />
                        </div>
                    </ThemeProvider>
                </AuthSessionProvider>
            </body>
        </html>
    )
}
