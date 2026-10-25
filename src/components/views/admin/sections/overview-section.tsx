"use client"

// Overview — KPI cards, 14-day orders/revenue chart, top products, Rx vs OTC,
// status breakdown and recent audit activity.

import { useCallback, useEffect, useState } from "react"
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/use-auth-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { adminApi } from "@/lib/api-client"
import type { AdminStats, AuditLogDTO } from "@/lib/types"
import { ACTIVE_STATUSES, ORDER_STATUS_LABELS } from "@/lib/constants"
import { formatKES, timeAgo } from "@/lib/format"
import { AdminSectionHeader, apiErrorMessage, KpiCard, KpiSkeletonGrid, SectionError, type SectionProps } from "../admin-shared"
import {
  Package, Banknote, Clock, ClipboardList, Wallet, AlertTriangle, Users, FileText, BarChart3, ArrowUpRight, ChevronRight, CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

const dayLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" })

export function OverviewSection({ refreshKey, onNavigateSection }: SectionProps) {
  const staffName = useAuthStore((state) => state.session?.staff?.name)
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
        <KpiSkeletonGrid count={4} />
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
      <AdminSectionHeader
        title="Pharmacy overview"
        subtitle="A little perspective on your day. Orders, patients and the things that need your attention."
        action={<Button variant="outline" onClick={() => onNavigateSection("reports")}><BarChart3 className="h-3.5 w-3.5" /> View reports <ArrowUpRight className="h-3.5 w-3.5" /></Button>}
      />

      <div className="admin-overview-hero">
        <div><p className="admin-eyebrow">YOUR DAILY BRIEFING</p><h2>Good care starts here{staffName ? `, ${staffName.split(" ")[0]}` : ""}.</h2><p>{stats.activeOrders > 0 ? `You have ${stats.activeOrders} active order${stats.activeOrders === 1 ? "" : "s"} and ${stats.pendingPrescriptions} prescription${stats.pendingPrescriptions === 1 ? "" : "s"} awaiting review. Let's keep things moving.` : "Your order queue is clear. You're ready for the next patient, the next order and the day ahead."}</p></div>
        <div className="admin-hero-actions"><Button onClick={() => onNavigateSection("orders")}>Open order queue <ArrowUpRight className="h-3.5 w-3.5" /></Button><Button variant="outline" onClick={() => onNavigateSection("service-bookings")}>Today's bookings</Button></div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Revenue today" value={formatKES(stats.revenueToday)} icon={Banknote} tone="emerald" hint={`${formatKES(stats.revenueThisWeek)} this week`} onClick={() => onNavigateSection("reports")} />
        <KpiCard label="Orders today" value={stats.ordersToday} icon={Package} tone="teal" hint={`${stats.ordersThisWeek} order${stats.ordersThisWeek === 1 ? "" : "s"} this week`} onClick={() => onNavigateSection("orders")} />
        <KpiCard label="Active orders" value={stats.activeOrders} icon={Clock} tone="amber" hint="Across your order queue" onClick={() => onNavigateSection("orders")} />
        <KpiCard label="Customers" value={stats.totalCustomers} icon={Users} tone="violet" hint={`${stats.totalProducts} products in catalogue`} />
      </div>

      {/* charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="admin-chart-title"><CardTitle>Revenue &amp; orders</CardTitle><span className="admin-period-label">Last 14 days</span></div><p className="admin-chart-subtitle">A daily look at how your pharmacy is doing.</p>
          </CardHeader>
          <CardContent>
            {dayData.length === 0 || dayData.every((d) => !d.orders && !d.revenue) ? (
              <EmptyState icon={BarChart3} title="No order history yet" description="Your order and revenue trends will appear here as sales come in." className="py-8" />
            ) : (
              <div className="h-64" role="img" aria-label="Chart of daily orders and revenue for the last 14 days">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dayData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number | string) => Number(v) >= 1000 ? `${Number(v) / 1000}k` : String(v)} />
                    <YAxis yAxisId="orders" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
                    <ChartTooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 11 }}
                      formatter={(value: number | string, name: string) =>
                        name === "Revenue" ? [formatKES(Number(value)), "Revenue"] : [String(value), "Orders"]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 15 }} iconType="circle" iconSize={6} />
                    <Area isAnimationActive={false} yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#revGradient)" />
                    <Line isAnimationActive={false} yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div className="admin-chart-title"><CardTitle>Needs your attention</CardTitle><span className="admin-period-label">{stats.pendingPrescriptions + stats.awaitingPayment + stats.lowStockCount + stats.outOfStockCount} items</span></div><p className="admin-chart-subtitle">Small actions that keep care moving.</p></CardHeader>
          <CardContent><div className="admin-attention-list">
            <button className="admin-attention-item" onClick={() => onNavigateSection("prescriptions")}><span className="bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"><ClipboardList className="h-4 w-4" /></span><span><strong>Prescription reviews</strong><small>{stats.pendingPrescriptions ? `${stats.pendingPrescriptions} waiting for a pharmacist` : "All prescriptions reviewed"}</small></span><ChevronRight className="h-3.5 w-3.5" /></button>
            <button className="admin-attention-item" onClick={() => onNavigateSection("orders", { status: "AWAITING_PAYMENT" })}><span className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"><Wallet className="h-4 w-4" /></span><span><strong>Awaiting payment</strong><small>{stats.awaitingPayment ? `${stats.awaitingPayment} orders to follow up` : "No payments to follow up"}</small></span><ChevronRight className="h-3.5 w-3.5" /></button>
            <button className="admin-attention-item" onClick={() => onNavigateSection("catalogue", { stock: stats.outOfStockCount > 0 ? "OUT_OF_STOCK" : "LOW_STOCK" })}><span className="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"><AlertTriangle className="h-4 w-4" /></span><span><strong>Inventory check</strong><small>{stats.lowStockCount} running low · {stats.outOfStockCount} out of stock</small></span><ChevronRight className="h-3.5 w-3.5" /></button>
          </div><div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/60 p-3 text-[10px] text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />Your team's next steps, all in one place.</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* top products */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="admin-chart-title"><CardTitle>Your bestsellers</CardTitle><button onClick={() => onNavigateSection("catalogue")} className="flex items-center gap-1 text-[10px] text-primary">Catalogue <ArrowUpRight className="h-3 w-3" /></button></div><p className="admin-chart-subtitle">The products your customers come back for.</p>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <EmptyState icon={Package} title="No product sales yet" description="Best-sellers appear here once orders are completed." className="py-8" />
            ) : (
              <div className="h-64" role="img" aria-label="Horizontal bar chart of top products by quantity sold">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="shortName" width={150} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <ChartTooltip formatter={(value: number | string) => [`${value} sold`, "Quantity"]} />
                    <Bar isAnimationActive={false} dataKey="qty" name="qty" fill="var(--chart-2)" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Sales mix</CardTitle><p className="admin-chart-subtitle">Prescription and over-the-counter orders.</p>
          </CardHeader>
          <CardContent>
            {stats.rxVsOtc.otc + stats.rxVsOtc.rx === 0 ? (
              <EmptyState icon={ClipboardList} title="No sales yet" description="Rx vs OTC split appears once orders are placed." className="py-8" />
            ) : (
              <div className="h-64" role="img" aria-label={`Donut chart of prescription versus over-the-counter sales: ${rxShare}% prescription`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie isAnimationActive={false}
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
                      <Cell fill="var(--chart-1)" aria-label={`${stats.rxVsOtc.rx} prescription orders`} />
                      <Cell fill="var(--chart-4)" aria-label={`${stats.rxVsOtc.otc} over-the-counter orders`} />
                    </Pie>
                    <ChartTooltip formatter={(value: number | string) => `${value} orders`} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 15 }} iconType="circle" iconSize={6} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.65fr]">
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
                      onClick={() => onNavigateSection("orders", { status: row.status })}
                      className="w-full rounded-md py-1 text-left"
                      aria-label={`View ${row.count} ${ORDER_STATUS_LABELS[row.status]} orders`}
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
            <ul className="admin-activity-list divide-y">
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
    </div>
  )
}
