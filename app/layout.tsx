// app/layout.tsx
import type { Metadata } from "next"
import { Be_Vietnam_Pro, Sora } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNav } from "@/components/main-nav"
import { Toaster } from "@/components/ui/toaster"
import { AuthSessionProvider } from "@/components/auth-session-provider" // 👈 thêm

const beVietnamPro = Be_Vietnam_Pro({
    subsets: ["latin", "vietnamese"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    variable: "--font-sans",
})

const sora = Sora({
    subsets: ["latin", "latin-ext"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
    variable: "--font-display",
})

export const metadata: Metadata = {
    title: "Flashcard Medicine",
    description: "Flashcard & MCQ cho sinh viên Y",
    manifest: "/manifest.json",
    applicationName: "Flashcard Medicine",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Flashcard Medicine",
    },
    formatDetection: {
      telephone: false,
    },
}

export const viewport = {
    themeColor: "#0ea5e9",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="vi" suppressHydrationWarning>
            <body
                className={`${beVietnamPro.variable} ${sora.variable} min-h-screen bg-background text-foreground antialiased`}
            >
                <AuthSessionProvider>
                    <ThemeProvider>
                        <div className="flex min-h-screen flex-col">
                            <MainNav />
                            <main className="flex-1 page-shell">{children}</main>
                            <Toaster />
                        </div>
                    </ThemeProvider>
                </AuthSessionProvider>
            </body>
        </html>
    )
}
