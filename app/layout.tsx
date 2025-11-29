// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ModeToggle } from "@/components/mode-toggle"

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
            <body>
                {/* ThemeProvider mình tự cố định attribute/defaultTheme bên trong rồi */}
                <ThemeProvider>
                    <div className="min-h-screen">
                        {/* Nếu chưa có ModeToggle thì comment block này lại */}
                        <div className="fixed right-4 top-4 z-50">
                            <ModeToggle />
                        </div>

                        {children}
                    </div>
                </ThemeProvider>
            </body>
        </html>
    )
}
