import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import nextEnv from "@next/env"

// Respect existing .env files and process variables; never rotate a working key.
nextEnv.loadEnvConfig(process.cwd(), true)
if (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) {
  console.log("Đã có khóa đăng nhập. Giữ nguyên cấu hình hiện tại.")
} else {
  const file = ".env.local"
  const previous = existsSync(file) ? readFileSync(file, "utf8") : ""
  const newline = previous && !previous.endsWith("\n") ? "\n" : ""
  writeFileSync(file, `${previous}${newline}AUTH_SECRET=${randomBytes(32).toString("base64url")}\n`, { mode: 0o600 })
  console.log("Đã tạo AUTH_SECRET trong .env.local. Không chia sẻ hoặc commit file này.")
}
