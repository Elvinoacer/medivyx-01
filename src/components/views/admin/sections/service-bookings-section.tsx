"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Loader2, Phone, RefreshCw, Users, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { adminServiceBookingsApi, serviceStaffApi } from "@/lib/api-client"
import type { AdminServiceBookingOverviewDTO, ServiceBookingDTO, ServiceBookingStatus, StaffDTO } from "@/lib/types"
import { AdminSectionHeader, KpiCard, TableSkeleton, type SectionProps, SectionError } from "../admin-shared"
import { toast } from "sonner"

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Nairobi" })
const localInput = (iso: string) => new Date(new Date(iso).getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
const todayInNairobi = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Nairobi" }).format(new Date())
const bookingDay = (iso: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ""
  return [part("year"), part("month"), part("day")].join("-")
}
const dayLabel = (date: string) => new Date(date + "T12:00:00+03:00").toLocaleDateString("en-KE", {
  timeZone: "Africa/Nairobi", weekday: "short", month: "short", day: "numeric",
})
const statusClass = (status: string) => ["CONFIRMED", "COMPLETED"].includes(status)
  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
  : ["CANCELLED", "REJECTED"].includes(status)
    ? "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
    : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"

export function ServiceBookingsSection({ refreshKey }: SectionProps) {
  const [date, setDate] = useState(todayInNairobi)
  const [bookings, setBookings] = useState<ServiceBookingDTO[]>([])
  const [overview, setOverview] = useState<AdminServiceBookingOverviewDTO | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<ServiceBookingDTO | null>(null)
  const [cancelFor, setCancelFor] = useState<ServiceBookingDTO | null>(null)
  const [newStart, setNewStart] = useState("")
  const [newEnd, setNewEnd] = useState("")
  const [staff, setStaff] = useState<StaffDTO[]>([])
  const requestId = useRef(0)
  const overviewRequestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error("Bookings are taking too long to load. Please try again.")), 10000) })
      const rows = await Promise.race([adminServiceBookingsApi.list(date), timeout])
      if (current === requestId.current) setBookings(rows)
    } catch (err) {
      if (current === requestId.current) setError(err instanceof Error ? err.message : "Could not load bookings.")
    } finally {
      clearTimeout(timeoutId)
      if (current === requestId.current) setLoading(false)
    }
  }, [date])

  const loadOverview = useCallback(async () => {
    const current = ++overviewRequestId.current
    setOverviewLoading(true)
    setOverviewError(null)
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("Booking overview took too long to load. Please try again.")), 10000)
      })
      const result = await Promise.race([adminServiceBookingsApi.overview(date), timeout])
      if (current === overviewRequestId.current) setOverview(result)
    } catch (err) {
      if (current === overviewRequestId.current) {
        setOverview(null)
        setOverviewError(err instanceof Error ? err.message : "Could not load booking overview.")
      }
    } finally {
      clearTimeout(timeoutId)
      if (current === overviewRequestId.current) setOverviewLoading(false)
    }
  }, [date])

  useEffect(() => { void loadOverview() }, [loadOverview, refreshKey])
  useEffect(() => { void load() }, [load, refreshKey])
  useEffect(() => { serviceStaffApi.list().then(setStaff).catch(() => {}) }, [])
  const summary = useMemo(() => ({
    pending: bookings.filter((b) => b.status === "PENDING").length,
    confirmed: bookings.filter((b) => b.status === "CONFIRMED").length,
    completed: bookings.filter((b) => b.status === "COMPLETED").length,
    total: bookings.length,
  }), [bookings])

  async function runAction(id: string, action: () => Promise<unknown>, message: string) {
    setBusy(id)
    try { await action(); toast.success(message); await Promise.all([load(), loadOverview()]); return true }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not update booking."); return false }
    finally { setBusy(null) }
  }
  const setStatus = (booking: ServiceBookingDTO, status: ServiceBookingStatus) => runAction(booking.id, () => adminServiceBookingsApi.updateStatus(booking.id, status), "Booking updated.")

  function moveDate(delta: number) {
    const next = new Date(`${date}T12:00:00+03:00`)
    next.setUTCDate(next.getUTCDate() + delta)
    setDate(next.toISOString().slice(0, 10))
  }

  async function saveReschedule() {
    if (!rescheduleFor) return
    const start = new Date(`${newStart}+03:00`)
    const end = new Date(`${newEnd}+03:00`)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
      toast.error("Choose an end time after the start time.")
      return
    }
    const saved = await runAction(rescheduleFor.id, () => adminServiceBookingsApi.reschedule(rescheduleFor.id, start.toISOString(), end.toISOString()), "Appointment rescheduled.")
    if (saved) setRescheduleFor(null)
  }

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Care appointments" subtitle="A calmer way to manage the day. Confirm visits, assign your team and keep every patient on track." action={<Button variant="outline" onClick={() => setDate(todayInNairobi())}><CalendarDays className="h-3.5 w-3.5" /> Today</Button>} />
      <Card>
        <div className="space-y-4 p-4 sm:p-5" aria-busy={overviewLoading}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Bookings across all dates</h2>
              <p className="mt-1 text-xs text-muted-foreground">An overview of appointments beyond the day selected below.</p>
            </div>
            {overview?.nextBookedDate ? (
              <Button variant="outline" size="sm" onClick={() => setDate(overview.nextBookedDate!)}>
                Next booked day: {dayLabel(overview.nextBookedDate)}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
          {overviewError ? <SectionError compact message={overviewError} onRetry={() => void loadOverview()} /> : (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-amber-200/70 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4 text-amber-600" />Awaiting confirmation</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{overviewLoading ? "—" : overview?.pendingCount ?? "—"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">All dates, including overdue</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 text-primary" />Upcoming visits</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{overviewLoading ? "—" : overview?.upcomingCount ?? "—"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Today onward · active bookings</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="h-4 w-4 text-primary" />Next appointment</p>
                {overviewLoading ? <p className="mt-2 text-2xl font-semibold">—</p> : overview?.nextBooking ? (
                  <button type="button" className="mt-2 block text-left text-sm font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setDate(bookingDay(overview.nextBooking!.scheduledStart))}>
                    {dayLabel(bookingDay(overview.nextBooking.scheduledStart))} · {timeLabel(overview.nextBooking.scheduledStart)}
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">{overview.nextBooking.serviceName} · View day</span>
                  </button>
                ) : <p className="mt-2 text-xs text-muted-foreground">No upcoming visits</p>}
              </div>
            </div>
          )}
          {!overviewLoading && !overviewError && overview?.pendingPreview.length ? (
            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-semibold">Needs confirmation <span className="font-normal text-muted-foreground">· Select an appointment to open its day</span></p>
              <div className="grid gap-2 sm:grid-cols-2">
                {overview.pendingPreview.map((booking) => (
                  <button type="button" key={booking.id} onClick={() => setDate(bookingDay(booking.scheduledStart))} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{dayLabel(bookingDay(booking.scheduledStart))} · {timeLabel(booking.scheduledStart)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{booking.serviceName} · {booking.customerName || "Customer"}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
              {overview.pendingCount > overview.pendingPreview.length ? <p className="mt-2 text-[11px] text-muted-foreground">Showing the earliest {overview.pendingPreview.length} of {overview.pendingCount} pending visits.</p> : null}
            </div>
          ) : null}
        </div>
      </Card>
      <p className="text-xs font-semibold text-muted-foreground">Selected day · {dayLabel(date)}</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy={loading}>
        <KpiCard label="Appointments" value={loading ? "—" : summary.total} icon={CalendarDays} tone="teal" hint="For the selected day" />
        <KpiCard label="Awaiting confirmation" value={loading ? "—" : summary.pending} icon={Clock3} tone="amber" hint="For the selected day" />
        <KpiCard label="Confirmed visits" value={loading ? "—" : summary.confirmed} icon={Users} tone="violet" hint="For the selected day" />
        <KpiCard label="Completed visits" value={loading ? "—" : summary.completed} icon={CheckCircle2} tone="emerald" hint="Care delivered" />
      </div>
      <Card><div className="admin-schedule-toolbar"><p>Daily schedule <span className="ml-1 text-[10px] font-normal text-muted-foreground">· Nairobi time (EAT)</span></p><Button variant="ghost" size="icon" onClick={() => moveDate(-1)} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></Button><Input aria-label="Appointment date" type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value) }} className="w-auto" /><Button variant="ghost" size="icon" onClick={() => moveDate(1)} aria-label="Next day"><ChevronRight className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => { void load(); void loadOverview() }} disabled={loading || overviewLoading} aria-label="Refresh bookings"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div></Card>
      {error ? <SectionError message={error} onRetry={() => void load()} /> : loading ? <TableSkeleton rows={3} /> : bookings.length === 0 ? <EmptyState icon={CalendarDays} title="A little space in the schedule" description="There are no appointments for the selected day. Use the all-dates overview above to find pending or upcoming bookings." /> : <div className="space-y-3">{bookings.map((booking) => (
        <Card key={booking.id}><div className="admin-booking-card">
          <div className="admin-booking-time"><strong>{timeLabel(booking.scheduledStart)}</strong><span>to {timeLabel(booking.scheduledEnd)}</span></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-semibold">{booking.serviceName}</h2><Badge className={statusClass(booking.status)} variant="outline">{booking.status.replaceAll("_", " ").toLowerCase()}</Badge>{busy === booking.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Updating booking" /> : null}</div>
            <p className="mt-2 text-xs">{booking.customerName || "Customer"}<span className="ml-2 font-mono text-[10px] text-muted-foreground">{booking.reference}</span></p>
            {booking.customerPhone ? <a href={`tel:${booking.customerPhone}`} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"><Phone className="h-3 w-3" />{booking.customerPhone}</a> : null}
            {booking.customerNotes ? <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">{booking.customerNotes}</p> : null}
            <div className="mt-3 max-w-64"><Label htmlFor={`booking-staff-${booking.id}`} className="mb-2 block text-[10px] text-muted-foreground">Assigned team member</Label><Select value={booking.assignedStaffId || "unassigned"} disabled={!!busy} onValueChange={(value) => void runAction(booking.id, () => adminServiceBookingsApi.assign(booking.id, value === "unassigned" ? null : value), "Staff assignment updated.")}><SelectTrigger id={`booking-staff-${booking.id}`} className="w-full"><SelectValue placeholder="Assign staff" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{staff.filter((member) => member.active && ["ADMIN", "PHARMACIST", "STAFF"].includes(member.role)).map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="admin-booking-actions">
            {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(booking.status) ? <Button size="sm" variant="outline" onClick={() => { setRescheduleFor(booking); setNewStart(localInput(booking.scheduledStart)); setNewEnd(localInput(booking.scheduledEnd)) }} disabled={!!busy}>Reschedule</Button> : null}
            {booking.status === "PENDING" ? <Button size="sm" onClick={() => void setStatus(booking, "CONFIRMED")} disabled={!!busy}><Check className="h-3.5 w-3.5" />Confirm visit</Button> : null}
            {booking.status === "CONFIRMED" ? <Button size="sm" onClick={() => void setStatus(booking, "ARRIVED")} disabled={!!busy}>Mark arrived</Button> : null}
            {booking.status === "ARRIVED" ? <Button size="sm" onClick={() => void setStatus(booking, "IN_PROGRESS")} disabled={!!busy}>Start visit</Button> : null}
            {booking.status === "IN_PROGRESS" ? <Button size="sm" onClick={() => void setStatus(booking, "COMPLETED")} disabled={!!busy}>Complete visit</Button> : null}
            {["PENDING", "CONFIRMED"].includes(booking.status) ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setCancelFor(booking)} disabled={!!busy}><X className="h-3.5 w-3.5" />Cancel</Button> : null}
          </div>
        </div></Card>
      ))}</div>}
      <Dialog open={rescheduleFor !== null} onOpenChange={(open) => { if (!open && !busy) setRescheduleFor(null) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Find a better time</DialogTitle><DialogDescription>{rescheduleFor?.serviceName} · {rescheduleFor?.reference}<br />All times are in Nairobi (EAT).</DialogDescription></DialogHeader><div className="grid gap-4"><div className="space-y-2"><Label htmlFor="booking-new-start">Appointment start</Label><Input id="booking-new-start" type="datetime-local" value={newStart} onChange={(event) => setNewStart(event.target.value)} disabled={!!busy} /></div><div className="space-y-2"><Label htmlFor="booking-new-end">Appointment end</Label><Input id="booking-new-end" type="datetime-local" min={newStart} value={newEnd} onChange={(event) => setNewEnd(event.target.value)} disabled={!!busy} /></div></div><DialogFooter><Button variant="outline" onClick={() => setRescheduleFor(null)} disabled={!!busy}>Keep current time</Button><Button onClick={() => void saveReschedule()} disabled={!newStart || !newEnd || !!busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save new time</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={cancelFor !== null} onOpenChange={(open) => { if (!open && !busy) setCancelFor(null) }}><DialogContent><DialogHeader><DialogTitle>Cancel this appointment?</DialogTitle><DialogDescription>{cancelFor?.customerName || "This patient"}'s {cancelFor?.serviceName} appointment will be cancelled. Check that your patient knows about the change.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setCancelFor(null)} disabled={!!busy}>Keep appointment</Button><Button variant="destructive" disabled={!!busy} onClick={async () => { if (cancelFor && await setStatus(cancelFor, "CANCELLED")) setCancelFor(null) }}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Cancel appointment</Button></DialogFooter></DialogContent></Dialog>
    </div>
  )
}
