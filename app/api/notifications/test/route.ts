import { NextRequest, NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth-helpers"
import { getPushSubscriptionsCollection, ObjectId } from "@/lib/mongodb"
import { configureWebPush } from "@/lib/web-push"

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const push = configureWebPush()
  if (!push) return NextResponse.json({ error: "Thông báo chưa được cấu hình" }, { status: 503 })
  const body = await req.json().catch(() => null)
  if (typeof body?.endpoint !== "string") return NextResponse.json({ error: "Thiếu thiết bị" }, { status: 400 })
  const subscriptions = await getPushSubscriptionsCollection()
  const subscription = await subscriptions.findOne({ userId: new ObjectId(auth.userId), endpoint: body.endpoint, enabled: true })
  if (!subscription) return NextResponse.json({ error: "Thiết bị chưa bật thông báo" }, { status: 404 })
  try {
    await push.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify({ title: "Nhắc học đã sẵn sàng", body: "Bạn sẽ được nhắc khi flashcard đã đánh giá đến giờ ôn.", url: "/decks", tag: "study-reminder-test" }),
    )
    return NextResponse.json({ sent: true })
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 500
    if (statusCode === 404 || statusCode === 410) await subscriptions.deleteOne({ _id: subscription._id })
    return NextResponse.json({ error: "Chưa gửi được thông báo thử" }, { status: statusCode === 404 || statusCode === 410 ? 410 : 502 })
  }
}
