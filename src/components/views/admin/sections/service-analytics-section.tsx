"use client"

import { useCallback, useEffect, useState } from "react"
import { Banknote, BarChart3, CalendarDays, CheckCircle2, PieChart, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { serviceAnalyticsApi } from "@/lib/api-client"
import { formatKES } from "@/lib/format"
import { AdminSectionHeader, KpiCard, KpiSkeletonGrid, type SectionProps, SectionError } from "../admin-shared"

export function ServiceAnalyticsSection({ refreshKey }: SectionProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof serviceAnalyticsApi.summary>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await serviceAnalyticsApi.summary()) }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load service analytics.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load, refreshKey])

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Care in perspective" subtitle="Understand how your care services are performing over the last 30 days." action={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" />Refresh report</Button>} />
      {error ? <SectionError message={error} onRetry={() => void load()} /> : loading || !data ? <KpiSkeletonGrid count={4} /> : <>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Service revenue" value={formatKES(data.revenue)} icon={Banknote} tone="emerald" hint="Over the last 30 days" />
          <KpiCard label="Appointments" value={data.totalBookings} icon={CalendarDays} tone="teal" hint="Bookings across all services" />
          <KpiCard label="Completed visits" value={data.completed} icon={CheckCircle2} tone="violet" hint="Care successfully delivered" />
          <KpiCard label="Completion rate" value={`${data.completionRate}%`} icon={PieChart} tone="amber" hint={`${data.cancelled} cancelled appointments`} />
        </div>
        <Card><CardHeader><div className="admin-chart-title"><CardTitle>Service by service</CardTitle><span className="admin-period-label">Last 30 days</span></div><p className="admin-chart-subtitle">Booking share, completed visits and revenue for each care service.</p></CardHeader><CardContent>
          {data.byService.length ? <div className="grid gap-4 lg:grid-cols-2">{data.byService.map((row, index) => (
            <div key={row.service} className="rounded-xl border border-border p-5"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><h2 className="text-xs font-semibold">{row.service}</h2></div><p className="text-sm font-semibold tabular-nums">{formatKES(row.revenue)}</p></div><div className="mb-3 mt-5 flex justify-between gap-3 text-[10px] text-muted-foreground"><span>{row.bookings} appointments</span><span>{row.completed} completed</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${row.service}: ${Math.round(row.bookings / (data.totalBookings || 1) * 100)}% of bookings`}><div className="h-full rounded-full" style={{ width: `${Math.min(100, row.bookings / (data.totalBookings || 1) * 100)}%`, background: `var(--chart-${index % 5 + 1})` }} /></div></div>
          ))}</div> : <EmptyState icon={BarChart3} title="Your care story is just beginning" description="Service performance will appear here as patients book and complete their visits." />}
        </CardContent></Card>
      </>}
    </div>
  )
}
