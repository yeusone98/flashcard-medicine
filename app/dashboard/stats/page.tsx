"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import { ArrowLeft, Flame, Trophy, Target, TrendingUp } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatsData = {
  dailyReviews: { date: string; count: number }[]
  ratingBreakdown: { rating: string; count: number }[]
  hardestCards: { itemId: string; againCount: number }[]
  streak: number
  totalReviews: number
}

const RATING_COLORS: Record<string, string> = {
  again: "#ef4444",
  hard: "#f97316",
  good: "#eab308",
  easy: "#22c55e",
  unknown: "#94a3b8",
}

const RATING_LABELS: Record<string, string> = {
  again: "Lại",
  hard: "Khó",
  good: "Tốt",
  easy: "Dễ",
}

const BADGES = [
  { threshold: 7, label: "7 ngày streak 🔥", color: "border-amber-500/60 text-amber-600 dark:text-amber-400" },
  { threshold: 30, label: "30 ngày streak 💪", color: "border-orange-500/60 text-orange-600 dark:text-orange-400" },
  { threshold: 100, label: "100 thẻ ôn 🏆", color: "border-primary/60 text-primary" },
  { threshold: 500, label: "500 thẻ ôn 🎯", color: "border-green-500/60 text-green-600 dark:text-green-400" },
]

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const earnedBadges = data
    ? BADGES.filter(
        (b) => data.streak >= b.threshold || data.totalReviews >= b.threshold,
      )
    : []

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col gap-6 px-4 py-6 stagger">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
          <Link href="/dashboard">
            <ArrowLeft className="h-3 w-3" />
            Dashboard
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Thống kê ôn tập
        </h1>
        <p className="text-sm text-muted-foreground">
          Dữ liệu ôn tập 30 ngày gần nhất.
        </p>
      </header>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Đang tải thống kê...</p>
        </div>
      ) : !data ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Không tải được dữ liệu thống kê.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.totalReviews}</p>
                  <p className="text-xs text-muted-foreground">Tổng lượt ôn</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.streak}</p>
                  <p className="text-xs text-muted-foreground">Ngày streak</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {data.dailyReviews.length > 0
                      ? Math.round(
                          data.dailyReviews.reduce((s, d) => s + d.count, 0) /
                            data.dailyReviews.length,
                        )
                      : 0}
                  </p>
                  <p className="text-xs text-muted-foreground">TB thẻ/ngày</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                  <Trophy className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{earnedBadges.length}</p>
                  <p className="text-xs text-muted-foreground">Huy hiệu</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Badges */}
          {earnedBadges.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Huy hiệu đạt được</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {earnedBadges.map((badge) => (
                  <Badge
                    key={badge.label}
                    variant="outline"
                    className={cn("text-xs", badge.color)}
                  >
                    {badge.label}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Bar chart — daily reviews */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Số thẻ ôn mỗi ngày (30 ngày)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.dailyReviews.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu ôn tập.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.dailyReviews}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(d: string) => d.slice(5)}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10 }}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(d) => `Ngày ${String(d)}`}
                    />
                    <Bar
                      dataKey="count"
                      name="Số thẻ"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Pie chart — rating breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tỉ lệ đánh giá</CardTitle>
              </CardHeader>
              <CardContent>
                {data.ratingBreakdown.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Chưa có dữ liệu.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.ratingBreakdown}
                        dataKey="count"
                        nameKey="rating"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(props: any) =>
                          `${RATING_LABELS[props.rating] ?? props.rating}: ${props.count}`
                        }
                      >
                        {data.ratingBreakdown.map((entry) => (
                          <Cell
                            key={entry.rating}
                            fill={
                              RATING_COLORS[entry.rating] ?? RATING_COLORS.unknown
                            }
                          />
                        ))}
                      </Pie>
                      <Legend
                        formatter={(value: string) =>
                          RATING_LABELS[value] ?? value
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Hardest cards */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Thẻ khó nhất (nhiều lần &quot;Lại&quot;)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.hardestCards.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Chưa có thẻ nào bị đánh &quot;Lại&quot;.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.hardestCards.map((card, i) => (
                      <div
                        key={card.itemId}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span className="truncate text-muted-foreground">
                          #{i + 1} · {card.itemId.slice(-6)}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          {card.againCount} lần
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  )
}
