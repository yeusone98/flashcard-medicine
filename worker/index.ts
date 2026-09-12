/// <reference lib="webworker" />

export {}

declare const self: ServiceWorkerGlobalScope

type ReminderPayload = {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener("push", event => {
  let payload: ReminderPayload = {}
  try {
    payload = event.data?.json() as ReminderPayload
  } catch {
    payload = { body: event.data?.text() }
  }
  event.waitUntil(self.registration.showNotification(
    payload.title || "Flashcard Medicine",
    {
      body: payload.body || "Bạn có flashcard cần ôn lại.",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      tag: payload.tag || "study-reminder",
      data: { url: payload.url || "/decks" },
    },
  ))
})

self.addEventListener("notificationclick", event => {
  event.notification.close()
  const path = String(event.notification.data?.url || "/decks")
  const target = new URL(path, self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin)) {
        await client.navigate(target)
        return client.focus()
      }
    }
    return self.clients.openWindow(target)
  })())
})
