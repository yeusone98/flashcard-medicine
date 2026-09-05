import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6" aria-busy="true">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Đang tải trang…
      </p>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-40 rounded-2xl bg-muted/60" />
          <div className="h-40 rounded-2xl bg-muted/60" />
        </div>
      </div>
    </div>
  )
}
