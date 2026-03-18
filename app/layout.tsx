// app/layout.tsx
import type { Metadata } from "next"
import { Be_Vietnam_Pro, Sora } from "next/font/google"

import { auth } from "@/auth"
import { AuthSessionProvider } from "@/components/auth-session-provider"
import { MainNav } from "@/components/main-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

import "./globals.css"

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
    description: "Flashcard & MCQ cho sinh viÃªn Y",
    manifest: "/manifest.json",
    applicationName: "Flashcard Medicine",
    icons: {
      icon: [
        { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [
        { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      ],
      shortcut: "/icon-192x192.png",
    },
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

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    return (
        <html lang="vi" suppressHydrationWarning>
            <body
                className={`${beVietnamPro.variable} ${sora.variable} min-h-screen bg-background text-foreground antialiased`}
            >
                <AuthSessionProvider session={session}>
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
