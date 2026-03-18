import { createRequire } from "node:module"

import type { NextConfig } from "next"

const require = createRequire(import.meta.url)

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
}

const isDevelopment = process.env.NODE_ENV === "development"
const isPwaDisabled = process.env.NEXT_DISABLE_PWA === "true"

function withOptionalPwa(config: NextConfig): NextConfig {
  if (isDevelopment || isPwaDisabled) {
    return config
  }

  let withPWAInit: ((options: Record<string, unknown>) => (input: NextConfig) => NextConfig) | null =
    null

  try {
    withPWAInit = require("@ducanh2912/next-pwa").default as (
      options: Record<string, unknown>,
    ) => (input: NextConfig) => NextConfig
  } catch (error) {
    const moduleNotFound =
      error instanceof Error &&
      "code" in error &&
      error.code === "MODULE_NOT_FOUND"

    if (!moduleNotFound) {
      throw error
    }

    console.warn(
      "[next.config] @ducanh2912/next-pwa is not installed. Continuing without PWA support.",
    )
    return config
  }

  const withPWA = withPWAInit({
    dest: "public",
    disable: false,
    register: true,
  })

  return withPWA(config)
}

export default withOptionalPwa(nextConfig)
