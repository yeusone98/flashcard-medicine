export const STUDY_TIME_ZONE = "Asia/Ho_Chi_Minh"
const DAY = 86_400_000
const OFFSET = 7 * 60 * 60 * 1000

export function studyDateKey(date = new Date()): string {
  return new Date(date.getTime() + OFFSET).toISOString().slice(0, 10)
}

export function startOfStudyDay(date = new Date()): Date {
  return new Date(Math.floor((date.getTime() + OFFSET) / DAY) * DAY - OFFSET)
}

export function studyStreak(days: string[], now = new Date()): number {
  const dates = new Set(days)
  let cursor = now.getTime()
  if (!dates.has(studyDateKey(now))) cursor -= DAY
  let count = 0
  while (dates.has(studyDateKey(new Date(cursor)))) {
    count++
    cursor -= DAY
  }
  return count
}

export function reviewIntervalLabel(minutes: number): string {
  if (minutes < 60) return `sau ${Math.max(1, Math.round(minutes))} phút`
  if (minutes < 1440) return `sau ${Math.round(minutes / 60)} giờ`
  return `sau ${Math.round(minutes / 1440)} ngày`
}
