"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowRight, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Filter, History, Loader2, Mail, Phone, RefreshCw, Search, UserRound, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { adminServiceBookingsApi, serviceStaffApi } from "@/lib/api-client"
import type { AdminBookingRange, AdminBookingView, AdminServiceBookingOverviewDTO, AdminServiceBookingPage, ServiceBookingDTO, ServiceBookingStatus, StaffDTO } from "@/lib/types"
import { AdminSectionHeader, SectionError, useDebounced, type SectionProps } from "../admin-shared"
import { toast } from "sonner"

const TZ = "Africa/Nairobi"
const PAGE_SIZE = 20
const statusOptions: ServiceBookingStatus[] = ["PENDING", "CONFIRMED", "RESCHEDULED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED"]
const statusNames: Record<ServiceBookingStatus, string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", RESCHEDULED: "Rescheduled",
  ARRIVED: "Arrived", IN_PROGRESS: "In progress", COMPLETED: "Completed",
  CANCELLED: "Cancelled", NO_SHOW: "No-show", REJECTED: "Declined",
}
const nextAction: Partial<Record<ServiceBookingStatus, { status: ServiceBookingStatus; label: string }>> = {
  PENDING: { status: "CONFIRMED", label: "Confirm" },
  RESCHEDULED: { status: "CONFIRMED", label: "Confirm" },
  CONFIRMED: { status: "ARRIVED", label: "Check in" },
  ARRIVED: { status: "IN_PROGRESS", label: "Start visit" },
  IN_PROGRESS: { status: "COMPLETED", label: "Complete" },
}
const todayNairobi = () => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())
  const value = (key: string) => parts.find(part => part.type === key)?.value || ""
  return [value("year"), value("month"), value("day")].join("-")
}
const dateText = (iso: string) => new Date(iso).toLocaleDateString("en-KE", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" })
const timeText = (iso: string) => new Date(iso).toLocaleTimeString("en-KE", { timeZone: TZ, hour: "numeric", minute: "2-digit" })
const dateTimeText = (iso: string) => dateText(iso) + " · " + timeText(iso)
const localInput = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600000).toISOString().slice(0, 16)
const statusColors: Record<ServiceBookingStatus, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  CONFIRMED: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  RESCHEDULED: "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
  ARRIVED: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200",
  IN_PROGRESS: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-200",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "border-muted bg-muted text-muted-foreground",
  NO_SHOW: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
  REJECTED: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200",
}
const statusBadge = (status: ServiceBookingStatus) => <Badge variant="outline" className={"whitespace-nowrap text-[11px] font-semibold " + statusColors[status]}>{statusNames[status]}</Badge>

export function ServiceBookingsSection({ refreshKey }: SectionProps) {
  const [view, setView] = useState<AdminBookingView>("queue")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounced(search, 300)
  const [range, setRange] = useState<AdminBookingRange>("any")
  const [from, setFrom] = useState(todayNairobi)
  const [to, setTo] = useState(todayNairobi)
  const [status, setStatusFilter] = useState("all")
  const [staffId, setStaffFilter] = useState("all")
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState<AdminServiceBookingPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [overview, setOverview] = useState<AdminServiceBookingOverviewDTO | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffDTO[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ServiceBookingDTO | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<ServiceBookingDTO | null>(null)
  const [newStart, setNewStart] = useState("")
  const [cancelFor, setCancelFor] = useState<ServiceBookingDTO | null>(null)
  const [noShowFor, setNoShowFor] = useState<ServiceBookingDTO | null>(null)
  const rowsRequest = useRef(0)
  const detailRequest = useRef(0)
  const lastRefreshKey = useRef(refreshKey)

  const loadRows = useCallback(async (background = false) => {
    const request = ++rowsRequest.current
    if (!background) {
      setLoading(true)
      setError(null)
    }
    try {
      const result = await adminServiceBookingsApi.search({
        view, page, pageSize: PAGE_SIZE, q: debouncedSearch,
        range, from: range === "custom" ? from : undefined,
        to: range === "custom" ? to : undefined, status, staffId,
      })
      if (request === rowsRequest.current) {
        setData(result)
        setError(null)
        if (result.totalPages < page) setPage(result.totalPages)
      }
    } catch (err) {
      if (request === rowsRequest.current && !background) {
        setError(err instanceof Error ? err.message : "Could not load appointments.")
        setData(null)
      }
      // Background failures do not hide rows or interrupt another staff task.
    } finally {
      if (request === rowsRequest.current) setLoading(false)
    }
  }, [view, page, debouncedSearch, range, from, to, status, staffId])

  const loadOverview = useCallback(async () => {
    try {
      const result = await adminServiceBookingsApi.overview(todayNairobi())
      setOverview(result)
      setOverviewError(null)
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : "Could not load appointment totals.")
    }
  }, [])

  useEffect(() => { void loadRows() }, [loadRows])
  useEffect(() => { void loadOverview() }, [loadOverview])
  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return
    lastRefreshKey.current = refreshKey
    void loadRows(true)
    void loadOverview()
  }, [refreshKey, loadRows, loadOverview])
  useEffect(() => { serviceStaffApi.list().then(setStaff).catch(() => {}) }, [])

  const loadDetail = useCallback(async (id: string) => {
    const request = ++detailRequest.current
    setDetailLoading(true)
    setDetailError(null)
    try {
      const result = await adminServiceBookingsApi.detail(id)
      if (request === detailRequest.current) setDetail(result)
    } catch (err) {
      if (request === detailRequest.current) setDetailError(err instanceof Error ? err.message : "Could not load details.")
    } finally {
      if (request === detailRequest.current) setDetailLoading(false)
    }
  }, [])

  function openDetail(id: string) {
    setDetail(null)
    setSelectedId(id)
    void loadDetail(id)
  }
  function closeDetail() {
    detailRequest.current++
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
  }
  function changeView(next: AdminBookingView) {
    setView(next)
    setPage(1)
    setStatusFilter("all")
  }
  function changeRange(next: AdminBookingRange) {
    setRange(next)
    setPage(1)
  }
  function resetFilters() {
    setSearch("")
    setRange("any")
    setStatusFilter("all")
    setStaffFilter("all")
    setPage(1)
  }
  const filtersActive = range !== "any" || status !== "all" || staffId !== "all" || search.trim().length > 0
  const staffOptions = useMemo(() => staff.filter(member => member.active && ["ADMIN", "PHARMACIST", "STAFF"].includes(member.role)), [staff])
  const staffName = (id: string | null | undefined) => staff.find(member => member.id === id)?.name || "Unassigned"

  async function runAction(
    id: string,
    action: () => Promise<unknown>,
    success: string,
    optimistic?: Partial<Pick<ServiceBookingDTO, "status" | "assignedStaffId">>,
  ) {
    if (busy) return false
    setBusy(id)
    const oldRow = data?.items.find((booking) => booking.id === id)
    const oldDetail = detail?.id === id ? detail : null
    // Staff actions feel immediate. On failure, restore the previous local
    // state and never claim success until the server confirms the action.
    if (optimistic) {
      setData((current) => current ? {
        ...current,
        items: current.items.map((booking) => booking.id === id ? { ...booking, ...optimistic } : booking),
      } : current)
      setDetail((current) => current?.id === id ? { ...current, ...optimistic } : current)
    }
    try {
      await action()
      toast.success(success)
      await Promise.all([loadRows(true), loadOverview()])
      if (selectedId === id) await loadDetail(id)
      return true
    } catch (err) {
      if (optimistic) {
        if (oldRow) setData((current) => current ? {
          ...current,
          items: current.items.map((booking) => booking.id === id ? oldRow : booking),
        } : current)
        if (oldDetail) setDetail((current) => current?.id === id ? oldDetail : current)
        void loadRows(true)
      }
      toast.error(err instanceof Error ? err.message : "Unable to update appointment.")
      return false
    } finally {
      setBusy(null)
    }
  }

  function openReschedule(booking: ServiceBookingDTO) {
    closeDetail()
    setRescheduleFor(booking)
    setNewStart(localInput(booking.scheduledStart))
  }
  async function saveReschedule() {
    if (!rescheduleFor || !newStart) return
    const start = new Date(newStart + "+03:00")
    const duration = new Date(rescheduleFor.scheduledEnd).getTime() - new Date(rescheduleFor.scheduledStart).getTime()
    if (!Number.isFinite(start.getTime()) || start.getTime() < Date.now() || duration <= 0) {
      toast.error("Choose a valid future appointment time.")
      return
    }
    const end = new Date(start.getTime() + duration)
    const saved = await runAction(rescheduleFor.id, () => adminServiceBookingsApi.reschedule(rescheduleFor.id, start.toISOString(), end.toISOString()), "Appointment rescheduled.")
    if (saved) setRescheduleFor(null)
  }
  function jumpToUpcoming() { changeView("upcoming"); changeRange("any") }
  function jumpToQueue() { changeView("queue"); changeRange("any") }

  const fallbackDetail = data?.items.find(item => item.id === selectedId)
  const activeDetail = detail || fallbackDetail
  const shown = data?.items || []
  const firstIndex = data?.total ? ((data.page - 1) * data.pageSize + 1) : 0
  const lastIndex = data ? Math.min(data.page * data.pageSize, data.total) : 0

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        title="Care appointments"
        subtitle="Find any booking, manage today's visits, and stay on top of confirmations."
        action={<Button variant="outline" className="gap-2 rounded-xl" disabled={loading} onClick={() => { void loadRows(); void loadOverview() }}><RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")}/> Refresh</Button>}
      />

      <section aria-label="Appointment overview" className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={jumpToQueue} className="group flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left transition-colors hover:bg-amber-100/80 focus-visible:outline-2 focus-visible:outline-primary dark:border-amber-900 dark:bg-amber-950/25 dark:hover:bg-amber-950/50">
          <div><p className="text-xs font-semibold text-amber-900 dark:text-amber-200">Awaiting confirmation</p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{overview?.pendingCount ?? "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">Across all dates</p></div>
          <ArrowRight className="h-5 w-5 text-amber-700 transition-transform group-hover:translate-x-1"/>
        </button>
        <button type="button" onClick={jumpToUpcoming} className="group flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
          <div><p className="text-xs font-semibold text-muted-foreground">Upcoming visits</p><p className="mt-1 text-2xl font-bold tabular-nums">{overview?.upcomingCount ?? "—"}</p><p className="mt-1 text-[11px] text-muted-foreground">Active appointments</p></div>
          <CalendarDays className="h-5 w-5 text-primary"/>
        </button>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Next scheduled visit</p>
          {overview?.nextBooking ? <div className="mt-2"><p className="text-sm font-bold text-foreground">{dateTimeText(overview.nextBooking.scheduledStart)}</p><p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{overview.nextBooking.serviceName}</p></div>
            : <p className="mt-3 text-sm text-muted-foreground">No upcoming visits</p>}
        </div>
      </section>
      {overviewError ? <SectionError compact message={overviewError} onRetry={() => void loadOverview()}/> : null}

      <section aria-labelledby="booking-list-title" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5">
          <div><h2 id="booking-list-title" className="text-base font-semibold">Appointments</h2><p className="mt-0.5 text-xs text-muted-foreground">Search and manage bookings across all dates.</p></div>
          <span className="text-xs font-medium text-muted-foreground">Times in EAT (Nairobi)</span>
        </div>
        <div role="tablist" aria-label="Appointment views" className="flex gap-1 overflow-x-auto border-b px-3 pt-2 sm:px-4">
          {([
            ["queue", "Needs action", Clock3],
            ["upcoming", "Upcoming", CalendarClock],
            ["history", "History", History],
            ["all", "All bookings", Archive],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => changeView(key)}
              className={"inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 pb-3 pt-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary " + (view === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5"/>{label}{key === "queue" && overview ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-900 dark:bg-amber-950 dark:text-amber-200">{overview.pendingCount}</span> : null}
            </button>
          ))}
        </div>
        <div className="space-y-3 border-b px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[210px] flex-[2_1_300px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input aria-label="Find appointments" className="h-10 rounded-xl pl-9 pr-9" placeholder="Patient, phone, service or booking reference…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }}/>
              {search ? <button type="button" aria-label="Clear search" onClick={() => {setSearch("");setPage(1)}} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4"/></button> : null}
            </div>
            <Select value={range} onValueChange={value => changeRange(value as AdminBookingRange)}>
              <SelectTrigger aria-label="Filter by date" className="h-10 min-w-[135px] max-w-[185px] flex-1 rounded-xl"><CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground"/><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any date</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="next7">Next 7 days</SelectItem>
                <SelectItem value="custom">Date range…</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant={showFilters ? "secondary" : "outline"} className="h-10 gap-2 rounded-xl" aria-expanded={showFilters} onClick={() => setShowFilters(value => !value)}><Filter className="h-4 w-4"/> Filters{(status !== "all" || staffId !== "all") ? <span className="h-1.5 w-1.5 rounded-full bg-primary"/> : null}</Button>
          </div>
          {range === "custom" ? <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/40 p-3">
            <div className="space-y-1"><Label htmlFor="booking-filter-from" className="text-xs">From</Label><Input id="booking-filter-from" type="date" value={from} onChange={event => {setFrom(event.target.value);setPage(1)}} className="h-9 w-auto"/></div>
            <div className="space-y-1"><Label htmlFor="booking-filter-to" className="text-xs">To</Label><Input id="booking-filter-to" type="date" value={to} onChange={event => {setTo(event.target.value);setPage(1)}} className="h-9 w-auto"/></div>
            <p className="self-end pb-2 text-[11px] text-muted-foreground">Up to 12 months per search</p>
          </div> : null}
          {showFilters ? <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="min-w-[150px] flex-1 space-y-1"><Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={value => {setStatusFilter(value);setPage(1)}}>
                <SelectTrigger className="w-full rounded-lg"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="all">All statuses</SelectItem>{statusOptions.map(item => <SelectItem key={item} value={item}>{statusNames[item]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-[170px] flex-1 space-y-1"><Label className="text-xs">Assigned to</Label>
              <Select value={staffId} onValueChange={value => {setStaffFilter(value);setPage(1)}}>
                <SelectTrigger className="w-full rounded-lg"><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="all">Any team member</SelectItem><SelectItem value="unassigned">Unassigned</SelectItem>{staff.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div> : null}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span aria-live="polite">{loading ? "Searching appointments…" : (data ? data.total.toLocaleString("en-KE") + " matching appointment" + (data.total === 1 ? "" : "s") : "Appointments")}</span>
            {filtersActive ? <button type="button" onClick={resetFilters} className="font-semibold text-primary hover:underline">Clear filters</button> : <span>Showing bookings beyond the selected day</span>}
          </div>
        </div>

        {error ? <div className="p-4"><SectionError message={error} onRetry={() => void loadRows()}/></div>
        : loading && !data ? <div className="space-y-2 p-4">{Array.from({length: 5}).map((_,index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/60"/>)}</div>
        : !loading && data?.total === 0 ? <div className="px-5 py-14 text-center">
          <CalendarDays className="mx-auto h-9 w-9 text-muted-foreground/70"/>
          <h3 className="mt-3 text-sm font-semibold">{view === "queue" ? "You're all caught up" : "No appointments found"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{filtersActive ? "Try another name, status or date range." : view === "queue" ? "There are no appointments awaiting confirmation." : "Choose another view or date range to explore bookings."}</p>
          {filtersActive ? <Button size="sm" variant="outline" className="mt-4" onClick={resetFilters}>Clear filters</Button> : <Button size="sm" variant="outline" className="mt-4" onClick={() => changeView("all")}>Browse all bookings</Button>}
        </div> : <div aria-busy={loading}>
          <div className="hidden grid-cols-[128px_minmax(0,1.1fr)_minmax(0,1fr)_108px_116px] gap-3 border-b bg-muted/30 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span>Date & time</span><span>Patient</span><span>Care service</span><span>Status</span><span className="text-right">Action</span>
          </div>
          <div className={"divide-y " + (loading ? "opacity-60" : "")}>
            {shown.map(booking => {
              const action = nextAction[booking.status]
              const overdue = booking.status === "PENDING" && new Date(booking.scheduledStart).getTime() < Date.now()
              return <div key={booking.id} className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-muted/25 sm:px-5 md:grid-cols-[128px_minmax(0,1.1fr)_minmax(0,1fr)_108px_116px] md:items-center">
                <div className="flex items-center justify-between gap-2 md:block">
                  <div><p className="text-xs font-semibold text-foreground">{dateText(booking.scheduledStart)}</p><p className="mt-0.5 text-xs text-muted-foreground">{timeText(booking.scheduledStart)}</p></div>
                  <div className="md:hidden">{statusBadge(booking.status)}</div>
                </div>
                <div className="min-w-0">
                  <button type="button" onClick={() => openDetail(booking.id)} className="block max-w-full truncate text-left text-sm font-semibold text-foreground hover:text-primary hover:underline">{booking.customerName || "Patient"}</button>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{booking.reference}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{booking.serviceName}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{staffName(booking.assignedStaffId)}{booking.paymentStatus !== "UNPAID" ? " · " + booking.paymentStatus.toLowerCase().replaceAll("_", " ") : ""}</p>
                </div>
                <div className="hidden space-y-1 md:block">{statusBadge(booking.status)}{overdue ? <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-300">Past appointment</p> : null}</div>
                <div className="flex items-center justify-end gap-1 md:justify-end">
                  {action ? <Button size="sm" className="h-8 rounded-lg px-2.5 text-xs" disabled={busy !== null} onClick={() => void runAction(booking.id, () => adminServiceBookingsApi.updateStatus(booking.id, action.status), statusNames[action.status] + ".", { status: action.status })}>{busy === booking.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : null}{action.label}</Button> : null}
                  <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-xs" onClick={() => openDetail(booking.id)}>Details</Button>
                </div>
              </div>
            })}
          </div>
        </div>}
        {data && data.total > 0 && !error ? <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-4 py-3 sm:px-5">
          <span className="text-xs text-muted-foreground">{firstIndex.toLocaleString("en-KE")}–{lastIndex.toLocaleString("en-KE")} of {data.total.toLocaleString("en-KE")}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage(value => Math.max(1, value-1))}><ChevronLeft className="h-4 w-4"/> Previous</Button>
            <span className="px-1 text-xs font-medium tabular-nums">{data.page} / {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={loading || page >= data.totalPages} onClick={() => setPage(value => value+1)}>Next <ChevronRight className="h-4 w-4"/></Button>
          </div>
        </div> : null}
      </section>

      <Dialog open={selectedId !== null} onOpenChange={open => { if (!open && !busy) closeDetail() }}>
        <DialogContent className="max-h-[92dvh] w-[95vw] max-w-[95vw] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-5 text-lg">Appointment details</DialogTitle>
            <DialogDescription>Booking information and complete care workflow · Nairobi time</DialogDescription>
          </DialogHeader>
          {detailError ? <SectionError compact message={detailError} onRetry={() => {if(selectedId)void loadDetail(selectedId)}}/> : null}
          {!activeDetail ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading appointment…</div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-muted/40 p-4">
              <div><p className="text-xs text-muted-foreground">Reference</p><p className="font-mono text-sm font-bold">{activeDetail.reference}</p><p className="mt-3 text-base font-semibold">{activeDetail.serviceName}</p><p className="mt-1 text-xs text-muted-foreground">{dateTimeText(activeDetail.scheduledStart)} – {timeText(activeDetail.scheduledEnd)}</p></div>
              {statusBadge(activeDetail.status)}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2.5">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground"><UserRound className="h-4 w-4"/> Patient</h3>
                <p className="text-sm font-semibold">{activeDetail.customerName || "Patient"}</p>
                {activeDetail.customerPhone ? <a href={"tel:" + activeDetail.customerPhone} className="flex items-center gap-2 text-xs text-primary hover:underline"><Phone className="h-3.5 w-3.5"/>{activeDetail.customerPhone}</a> : null}
                {activeDetail.customerEmail ? <a href={"mailto:" + activeDetail.customerEmail} className="flex items-center gap-2 break-all text-xs text-primary hover:underline"><Mail className="h-3.5 w-3.5"/>{activeDetail.customerEmail}</a> : null}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Assigned team member</h3>
                <Select value={activeDetail.assignedStaffId || "unassigned"} disabled={busy !== null || detailLoading} onValueChange={value => void runAction(activeDetail.id, () => adminServiceBookingsApi.assign(activeDetail.id, value === "unassigned" ? null : value), "Team member updated.", { assignedStaffId: value === "unassigned" ? null : value })}>
                  <SelectTrigger aria-label="Assign team member" className="h-10 w-full rounded-xl"><SelectValue placeholder="Choose staff"/></SelectTrigger>
                  <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{staffOptions.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Payment: {activeDetail.paymentStatus.toLowerCase().replaceAll("_", " ")}</p>
              </div>
            </div>
            {activeDetail.customerNotes || activeDetail.staffNotes ? <div className="space-y-3 rounded-xl border p-3">
              {activeDetail.customerNotes ? <div><h3 className="text-xs font-bold text-foreground">Patient notes</h3><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{activeDetail.customerNotes}</p></div> : null}
              {activeDetail.staffNotes ? <div><h3 className="text-xs font-bold text-foreground">Team notes</h3><p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{activeDetail.staffNotes}</p></div> : null}
            </div> : null}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {nextAction[activeDetail.status] ? <Button className="gap-2" disabled={busy !== null || detailLoading} onClick={() => {
                const next = nextAction[activeDetail.status]
                if (next) void runAction(activeDetail.id, () => adminServiceBookingsApi.updateStatus(activeDetail.id, next.status), "Appointment updated.", { status: next.status })
              }}><Check className="h-4 w-4"/>{nextAction[activeDetail.status]?.label}</Button> : null}
              {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(activeDetail.status) ? <Button variant="outline" disabled={busy !== null} onClick={() => openReschedule(activeDetail)}><CalendarClock className="mr-2 h-4 w-4"/> Reschedule</Button> : null}
              {["PENDING", "CONFIRMED", "RESCHEDULED"].includes(activeDetail.status) ? <Button variant="outline" className="text-destructive hover:text-destructive" disabled={busy !== null} onClick={() => {setCancelFor(activeDetail);closeDetail()}}><X className="mr-2 h-4 w-4"/> Cancel</Button> : null}
              {activeDetail.status === "ARRIVED" ? <Button variant="outline" disabled={busy !== null} onClick={() => {setNoShowFor(activeDetail);closeDetail()}}>Mark no-show</Button> : null}
            </div>
            <div className="border-t pt-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4"/> Recent activity (up to 100 changes) {detailLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : null}</h3>
              {detail?.statusHistory.length ? <ol className="space-y-3">{detail.statusHistory.map(event => <li key={event.id} className="flex items-start gap-3 text-xs">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"/>
                <div className="min-w-0"><p className="font-semibold">{statusNames[event.status as ServiceBookingStatus] || event.status}</p><p className="mt-0.5 text-muted-foreground">{dateTimeText(event.createdAt)}</p>{event.note ? <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{event.note}</p> : null}</div>
              </li>)}</ol> : <p className="text-xs text-muted-foreground">{detailLoading ? "Loading history…" : "No status changes recorded."}</p>}
            </div>
          </>}
          <DialogFooter><Button variant="outline" onClick={closeDetail} disabled={busy !== null}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleFor !== null} onOpenChange={open => { if (!open && !busy) setRescheduleFor(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Reschedule appointment</DialogTitle><DialogDescription>{rescheduleFor?.customerName} · {rescheduleFor?.serviceName}. Select a new start time (EAT). The appointment duration stays the same.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label htmlFor="booking-new-start">New start date and time</Label><Input id="booking-new-start" type="datetime-local" value={newStart} onChange={event => setNewStart(event.target.value)} disabled={busy !== null}/><p className="text-xs text-muted-foreground">The new time must be in the future, within service hours, and not overlap another booking.</p></div>
          <DialogFooter><Button variant="outline" disabled={busy !== null} onClick={() => setRescheduleFor(null)}>Keep current time</Button><Button disabled={busy !== null || !newStart} onClick={() => void saveReschedule()}>{busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin"/> : null}Save new time</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={cancelFor !== null} onOpenChange={open => { if (!open && !busy) setCancelFor(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-md"><DialogHeader><DialogTitle>Cancel this appointment?</DialogTitle><DialogDescription>{cancelFor?.customerName || "This patient"}'s appointment will be cancelled and they will be notified. This cannot be undone.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy !== null} onClick={() => setCancelFor(null)}>Keep appointment</Button><Button variant="destructive" disabled={busy !== null} onClick={async () => { if (cancelFor && await runAction(cancelFor.id, () => adminServiceBookingsApi.updateStatus(cancelFor.id, "CANCELLED"), "Appointment cancelled.", { status: "CANCELLED" })) setCancelFor(null) }}>Confirm cancellation</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={noShowFor !== null} onOpenChange={open => { if (!open && !busy) setNoShowFor(null) }}>
        <DialogContent className="rounded-2xl sm:max-w-md"><DialogHeader><DialogTitle>Mark as no-show?</DialogTitle><DialogDescription>This records that {noShowFor?.customerName || "the patient"} did not attend and sends them an update.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy !== null} onClick={() => setNoShowFor(null)}>Keep status</Button><Button variant="destructive" disabled={busy !== null} onClick={async () => { if (noShowFor && await runAction(noShowFor.id, () => adminServiceBookingsApi.updateStatus(noShowFor.id, "NO_SHOW"), "Marked as no-show.", { status: "NO_SHOW" })) setNoShowFor(null) }}>Mark no-show</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  )
}
