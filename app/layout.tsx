// app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
    title: "Flashcard Medicine",
    description: "Flashcard & MCQ cho sinh viên Y",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className="dark">
            <body>{children}</body>
        </html>
    )
}
