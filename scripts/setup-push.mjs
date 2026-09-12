import { existsSync, readFileSync, writeFileSync } from "node:fs"
import webPush from "web-push"

const path = ".env.local"
const current = existsSync(path) ? readFileSync(path, "utf8") : ""
if (/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/m.test(current) && /^VAPID_PRIVATE_KEY=/m.test(current)) {
  console.log("Web Push keys already exist in .env.local; nothing changed.")
  process.exit(0)
}

const keys = webPush.generateVAPIDKeys()
const separator = current && !current.endsWith("\n") ? "\n" : ""
const additions = [
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`,
  `VAPID_PRIVATE_KEY=${keys.privateKey}`,
  "VAPID_SUBJECT=https://flashcard-medicine.vercel.app",
  `CRON_SECRET=${crypto.randomUUID()}${crypto.randomUUID()}`,
].join("\n")
writeFileSync(path, `${current}${separator}${additions}\n`, { mode: 0o600 })
console.log("Created Web Push keys and CRON_SECRET in .env.local.")
console.log("Copy the four values to Vercel Environment Variables before deploying.")
