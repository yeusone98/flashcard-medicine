// app/dashboard/page.tsx
import { requireSession } from "@/lib/require-user"
import DashboardClient from "./dashboard-client"

export default async function DashboardPage() {
  await requireSession()
  return <DashboardClient />
}
