// app/shared/[token]/shared-clone-button.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookOpenCheck, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"

interface Props {
  deckId: string
  size?: "sm" | "default"
}

export default function SharedCloneButton({ deckId, size = "sm" }: Props) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  async function handleClone() {
    if (!session?.user) {
      router.push(`/login?callbackUrl=/decks`)
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/decks/${deckId}/clone`, { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Clone thất bại",
          description: data.error ?? "Vui lòng thử lại.",
        })
        return
      }

      toast({
        title: "Clone thành công! 🎉",
        description: `Đã sao chép ${data.flashcardCount} flashcards và ${data.questionCount} câu MCQ vào tài khoản của bạn.`,
      })

      router.push(`/decks/${data.newDeckId}`)
    } catch {
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Có lỗi xảy ra, vui lòng thử lại.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size={size} disabled={loading} onClick={handleClone}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <BookOpenCheck className="mr-2 h-4 w-4" />
      )}
      {session?.user ? "Clone về tài khoản" : "Đăng nhập để Clone"}
    </Button>
  )
}
