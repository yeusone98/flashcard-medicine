import "server-only"

import webPush from "web-push"

let configured = false

export function publicVapidKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? ""
}

export function configureWebPush() {
  const publicKey = publicVapidKey()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? ""
  if (!publicKey || !privateKey) return null

  if (!configured) {
    const contact = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@example.com"
    webPush.setVapidDetails(contact, publicKey, privateKey)
    configured = true
  }

  return webPush
}
