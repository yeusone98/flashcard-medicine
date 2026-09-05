export function createServerTiming() {
  const started = performance.now()
  const durations = new Map<string, number>()
  return {
    async measure<T>(name: string, work: () => Promise<T>): Promise<T> {
      const start = performance.now()
      try {
        return await work()
      } finally {
        // Transaction callbacks can retry; report all time spent, not just the last attempt.
        durations.set(name, (durations.get(name) ?? 0) + performance.now() - start)
      }
    },
    finish<T extends Response>(response: T): T {
      durations.set("total", performance.now() - started)
      response.headers.set("Server-Timing", Array.from(durations).map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`).join(", "))
      response.headers.set("Cache-Control", "private, no-store")
      return response
    },
  }
}
