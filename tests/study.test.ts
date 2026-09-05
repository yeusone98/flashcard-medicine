import { describe, it, expect } from "vitest"
import { studyDateKey, startOfStudyDay, studyStreak, reviewIntervalLabel } from "@/lib/study-time"
import { normalizeSteps } from "@/lib/fsrs"
import { restoreBackupData } from "@/lib/backup"

describe("Vietnam study day", () => {
  it("changes at midnight Vietnam instead of midnight UTC", () => {
    expect(studyDateKey(new Date("2026-09-04T16:59:59Z"))).toBe("2026-09-04")
    expect(studyDateKey(new Date("2026-09-04T17:00:00Z"))).toBe("2026-09-05")
    expect(startOfStudyDay(new Date("2026-09-05T01:00:00Z")).toISOString()).toBe("2026-09-04T17:00:00.000Z")
  })
  it("counts streaks across a month boundary and allows yesterday", () => {
    expect(studyStreak(["2026-08-30", "2026-08-31"], new Date("2026-09-01T01:00:00Z"))).toBe(2)
    expect(studyStreak(["2026-08-29"], new Date("2026-09-01T01:00:00Z"))).toBe(0)
  })
  it("shows short FSRS intervals in minutes and hours", () => {
    expect(reviewIntervalLabel(1)).toBe("sau 1 phút")
    expect(reviewIntervalLabel(10)).toBe("sau 10 phút")
    expect(reviewIntervalLabel(120)).toBe("sau 2 giờ")
    expect(reviewIntervalLabel(4320)).toBe("sau 3 ngày")
  })
  it("rejects unrecognized backups before any database writes", () => {
    expect(() => restoreBackupData({ format: "flashcard-medicine", version: 99 }, "000000000000000000000001")).toThrow()
  })
})

it("accepts learning steps separated by real newlines", () => {
  expect(normalizeSteps("1m\n10m", [])).toEqual(["1m", "10m"])
})
