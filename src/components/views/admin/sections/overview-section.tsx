"use client"

// Overview — KPI cards, 14-day orders/revenue chart, top products, Rx vs OTC,
// status breakdown and recent audit activity. Demo-mode note included.

import { useCallback, useEffect, useState } from "react"
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState, SectionHeader } from "@/components/shared/empty-state"
import { adminApi } from "@/lib/api-client"
import type { AdminStats, AuditLogDTO } from "@/lib/types"
import { ACTIVE_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants"
import { formatKES, timeAgo } from "@/lib/format"
import { apiErrorMessage, KpiCard, KpiSkeletonGrid, SectionError, type SectionProps } from "../admin-shared"
import {
  Package, Banknote, Clock, ClipboardList, Wallet, AlertTriangle, Users, Info, FileText, BarChart3,
} from "lucide-react"
import { cn } from "@/lib/utils"

const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" })

export function OverviewSection({ refreshKey, onNavigateSection }: SectionProps) {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [audit, setAudit] = useState<AuditLogDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const s = await adminApi.stats()
      setStats(s)
      try {
        setAudit((await adminApi.audit()).slice(0, 10))
      } catch {
        setAudit([]) // audit feed is non-critical
      }
    } catch (err) {
      setError(apiErrorMessage(err))
      setStats(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  if (loading) {
    return (
      <div className="space-y-5">
        <KpiSkeletonGrid />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  if (error || !stats) {
    return <SectionError message={error ?? "No stats available."} onRetry={() => void load()} />
  }

  const dayData = stats.ordersByDay.slice(-14).map((d) => ({ ...d, label: dayLabel(d.date) }))
  const topProducts = stats.topProducts.slice(0, 8).map((p) => ({
    ...p,
    shortName: p.name.length > 28 ? `${p.name.slice(0, 26)}…` : p.name,
  }))
  const rxShare =
    stats.rxVsOtc.otc + stats.rxVsOtc.rx > 0
      ? Math.round((stats.rxVsOtc.rx / (stats.rxVsOtc.otc + stats.rxVsOtc.rx)) * 100)
      : 0

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Today at Sphere Pharmacy"
        subtitle="Live snapshot of the order queue, revenue and inventory health."
      />

      {/* demo note */}
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-300/70 border-l-4 bg-amber-50/70 px-3 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-700/70 dark:border-l-amber-500 dark:bg-amber-950/30 dark:text-amber-300">
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        <p>
          Demo mode — payments are simulated, and WhatsApp/SMS notifications are logged in-app instead of sent.
          <span className="ml-1 font-normal text-amber-700/80 dark:text-amber-400/80">Live code, no money moves.</span>
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Orders today" value={stats.ordersToday} icon={Package} tone="teal" hint={`${stats.ordersThisWeek} this week`} onClick={() => onNavigateSection("orders")} />
        <KpiCard label="Revenue today" value={formatKES(stats.revenueToday)} icon={Banknote} tone="emerald" hint={`${formatKES(stats.revenueThisWeek)} this week`} />
        <KpiCard label="Active orders" value={stats.activeOrders} icon={Clock} tone="teal" onClick={() => onNavigateSection("orders")} />
        <KpiCard
          label="Pending prescriptions"
          value={stats.pendingPrescriptions}
          icon={ClipboardList}
          tone={stats.pendingPrescriptions > 0 ? "amber" : "default"}
          hint={stats.pendingPrescriptions > 0 ? "Needs pharmacist review" : "Queue is clear"}
          onClick={() => onNavigateSection("prescriptions")}
        />
        <KpiCard label="Awaiting payment" value={stats.awaitingPayment} icon={Wallet} tone={stats.awaitingPayment > 0 ? "amber" : "default"} onClick={() => onNavigateSection("orders")} />
        <KpiCard
          label="Low / out of stock"
          value={stats.lowStockCount + stats.outOfStockCount}
          icon={AlertTriangle}
          tone={stats.outOfStockCount > 0 ? "rose" : stats.lowStockCount > 0 ? "amber" : "default"}
          hint={`${stats.lowStockCount} low · ${stats.outOfStockCount} out`}
          onClick={() => onNavigateSection("catalogue")}
        />
        <KpiCard label="Total customers" value={stats.totalCustomers} icon={Users} hint={`${stats.totalProducts} products live`} />
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Orders &amp; revenue — last 14 days</CardTitle>
          </CardHeader>
          <CardContent>
            {dayData.length === 0 || dayData.every((d) => !d.orders && !d.revenue) ? (
              <EmptyState icon={BarChart3} title="No order history yet" description="Charts appear once orders start rolling in — place a demo order from the storefront to see them light up." className="py-8" />
            ) : (
              <div className="h-64" role="img" aria-label="Chart of daily orders and revenue for the last 14 days">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dayData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number | string) => `${Math.round(Number(v) / 1000)}k`} />
                    <YAxis yAxisId="orders" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip
                      formatter={(value: number | string, name: string) =>
                        name === "revenue" ? [formatKES(Number(value)), "Revenue"] : [String(value), "Orders"]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area yAxisId="rev" type="monotone" dataKey="revenue" name="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#revGradient)" />
                    <Line yAxisId="orders" type="monotone" dataKey="orders" name="orders" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Rx vs OTC sales</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.rxVsOtc.otc + stats.rxVsOtc.rx === 0 ? (
              <EmptyState icon={ClipboardList} title="No sales yet" description="Rx vs OTC split appears once orders are placed." className="py-8" />
            ) : (
              <div className="h-64" role="img" aria-label={`Donut chart of prescription versus over-the-counter sales: ${rxShare}% prescription`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Prescription (Rx)", value: stats.rxVsOtc.rx },
                        { name: "Over-the-counter", value: stats.rxVsOtc.otc },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="80%"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      <Cell fill="var(--chart-1)" />
                      <Cell fill="var(--chart-4)" />
                    </Pie>
                    <ChartTooltip formatter={(value: number | string) => `${value} orders`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* top products */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top products by quantity</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <EmptyState icon={Package} title="No product sales yet" description="Best-sellers appear here once orders are completed." className="py-8" />
            ) : (
              <div className="h-64" role="img" aria-label="Horizontal bar chart of top products by quantity sold">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="shortName" width={150} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <ChartTooltip formatter={(value: number | string) => [`${value} sold`, "Quantity"]} />
                    <Bar dataKey="qty" name="qty" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Orders by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {stats.statusBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              stats.statusBreakdown
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((row) => {
                  const max = Math.max(...stats.statusBreakdown.map((s) => s.count), 1)
                  return (
                    <button
                      key={row.status}
                      onClick={() => onNavigateSection("orders")}
                      className="w-full text-left"
                      aria-label={`Open orders filtered by ${ORDER_STATUS_LABELS[row.status]}: ${row.count} orders`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-xs">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", ACTIVE_STATUSES.includes(row.status) ? "bg-teal-500" : "bg-muted-foreground/50")} aria-hidden />
                          <span className="font-medium">{ORDER_STATUS_LABELS[row.status]}</span>
                        </span>
                        <span className="text-xs font-bold tabular-nums">{row.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(row.count / max) * 100}%` }} />
                      </div>
                    </button>
                  )
                })
            )}
          </CardContent>
        </Card>
      </div>

      {/* recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No recorded staff activity yet.</p>
          ) : (
            <ul className="divide-y">
              {audit.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-2.5">
                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                    {entry.actor.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">
                      <span className="font-semibold">{entry.actor}</span>
                      <span className="text-muted-foreground"> {entry.action.toLowerCase()}</span>
                      {entry.entity ? <span className="text-muted-foreground"> · {entry.entity}</span> : null}
                    </p>
                    {entry.details ? <p className="truncate text-xs text-muted-foreground">{entry.details}</p> : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
