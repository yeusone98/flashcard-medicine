import { NextRequest, NextResponse } from "next/server"

import { requireAuth } from "@/lib/auth-helpers"
import { getPushSubscriptionsCollection, ObjectId } from "@/lib/mongodb"
import { publicVapidKey } from "@/lib/web-push"

function validSubscription(value: unknown): value is {
  endpoint: string
  keys: { p256dh: string; auth: string }
} {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  const keys = item.keys as Record<string, unknown> | undefined
  return typeof item.endpoint === "string" &&
    item.endpoint.startsWith("https://") && item.endpoint.length <= 2048 &&
    typeof keys?.p256dh === "string" && keys.p256dh.length <= 512 &&
    typeof keys?.auth === "string" && keys.auth.length <= 256
}

export async function GET() {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  return NextResponse.json({
    configured: Boolean(publicVapidKey()),
    publicKey: publicVapidKey(),
    schedule: "every-minute",
    timeZone: "Asia/Ho_Chi_Minh",
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  if (!publicVapidKey()) return NextResponse.json({ error: "Thông báo chưa được cấu hình" }, { status: 503 })
  const body = await req.json().catch(() => null)
  if (!validSubscription(body?.subscription)) {
    return NextResponse.json({ error: "Thiết bị đăng ký không hợp lệ" }, { status: 400 })
  }
  const now = new Date()
  const subscriptions = await getPushSubscriptionsCollection()
  const userId = new ObjectId(auth.userId)
  const existing = await subscriptions.findOne({ endpoint: body.subscription.endpoint })
  if (existing && !existing.userId.equals(userId)) {
    return NextResponse.json({ error: "Thiết bị đã được đăng ký với tài khoản khác" }, { status: 409 })
  }
  if (!existing && await subscriptions.countDocuments({ userId }) >= 10) {
    return NextResponse.json({ error: "Tài khoản đã đạt giới hạn 10 thiết bị" }, { status: 409 })
  }
  await subscriptions.updateOne(
    { endpoint: body.subscription.endpoint, userId },
    {
      $set: {
        userId,
        keys: body.subscription.keys,
        enabled: true,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
      $unset: { lastSentDate: "" },
    },
    { upsert: true },
  )
  return NextResponse.json({ enabled: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const body = await req.json().catch(() => null)
  if (typeof body?.endpoint !== "string") {
    return NextResponse.json({ error: "Thiếu thiết bị cần tắt" }, { status: 400 })
  }
  const subscriptions = await getPushSubscriptionsCollection()
  await subscriptions.deleteOne({
    userId: new ObjectId(auth.userId),
    endpoint: body.endpoint,
  })
  return NextResponse.json({ enabled: false })
}
