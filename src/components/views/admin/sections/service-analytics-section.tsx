"use client"
import { useEffect, useState } from "react"
import { BarChart3, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { serviceAnalyticsApi } from "@/lib/api-client"
import { type SectionProps, SectionError } from "../admin-shared"

export function ServiceAnalyticsSection({ refreshKey }: SectionProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof serviceAnalyticsApi.summary>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function load() { try { setData(await serviceAnalyticsApi.summary()); setError(null) } catch (err) { setError(err instanceof Error ? err.message : "Could not load service analytics.") } }
  useEffect(() => { void load() }, [refreshKey])
  if (error) return <SectionError message={error} onRetry={() => void load()} />
  if (!data) return <div className="flex items-center justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
  return <div className="space-y-5"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">Service performance</h2><p className="mt-1 text-sm text-muted-foreground">Last 30 days of care-service activity and revenue.</p></div><Button variant="outline" size="icon" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Bookings",String(data.totalBookings)],["Completed",String(data.completed)],["Completion",data.completionRate+"%"],["Revenue","KSh "+data.revenue.toLocaleString()]].map(([label,value])=><Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></CardContent></Card>)}</div>
  <Card><CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4"/> By service</CardTitle></CardHeader><CardContent className="space-y-3">{data.byService.length ? data.byService.map((r)=><div key={r.service} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{r.service}</p><p className="text-sm font-bold">KSh {r.revenue.toLocaleString()}</p></div><div className="mt-2 flex gap-4 text-xs text-muted-foreground"><span>{r.bookings} bookings</span><span>{r.completed} completed</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:((r.bookings/(data.totalBookings||1))*100)+"%"}}/></div></div>) : <p className="text-sm text-muted-foreground">No service bookings in this period.</p>}</CardContent></Card></div>
}