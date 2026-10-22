"use client"

import { useEffect, useState } from "react"
import { Loader2, Pill, Phone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState } from "@/components/shared/empty-state"
import { medicineRequestsApi } from "@/lib/api-client"
import { MEDICINE_REQUEST_LABELS, MEDICINE_REQUEST_STATUSES, type MedicineRequestDTO, type MedicineRequestStatus, type MedicineRequestsResponse } from "@/lib/medicine-requests"
import { formatDateTime } from "@/lib/format"
import { apiErrorMessage, SectionError, useDebounced, type SectionProps } from "../admin-shared"

export function MedicineRequestsSection({ refreshKey }: SectionProps) {
  const [data, setData] = useState<MedicineRequestsResponse | null>(null)
  const [status, setStatus] = useState<"ALL" | MedicineRequestStatus>("ALL")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounced(search)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    medicineRequestsApi.list({ page, status: status === "ALL" ? undefined : status, search: debouncedSearch })
      .then((result) => { if (!cancelled) setData(result) })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, status, debouncedSearch, refreshKey, reload])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input value={search} maxLength={200} placeholder="Search medicine or phone number" aria-label="Search medicine requests" onChange={(event) => { setSearch(event.target.value); setPage(1) }} className="sm:max-w-sm" />
        <Select value={status} onValueChange={(value) => { setStatus(value as typeof status); setPage(1) }}>
          <SelectTrigger className="sm:w-44" aria-label="Filter requests by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {MEDICINE_REQUEST_STATUSES.map((value) => <SelectItem key={value} value={value}>{MEDICINE_REQUEST_LABELS[value]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {error ? <SectionError message={error} onRetry={() => setReload((value) => value + 1)} /> : null}
      {loading ? <Skeleton className="h-48 rounded-xl" aria-label="Loading medicine requests" /> : error ? null : data?.items.length ? (
        <>
          <p className="text-sm text-muted-foreground" role="status">{data.total} request{data.total === 1 ? "" : "s"}</p>
          <div className="space-y-3">
            {data.items.map((request) => <MedicineRequestRow key={`${request.id}:${request.updatedAt}`} request={request} onSaved={() => setReload((value) => value + 1)} />)}
          </div>
        </>
      ) : <EmptyState icon={Pill} title="No medicine requests" description="Requests from the shop will appear here. Try another search or status if you’ve filtered the list." />}
      {!loading && !error && data && (data.total > 0 || page > 1) ? (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page}</span>
          <Button variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      ) : null}
    </div>
  )
}

function MedicineRequestRow({ request, onSaved }: { request: MedicineRequestDTO; onSaved: () => void }) {
  const [status, setStatus] = useState(request.status)
  const [notes, setNotes] = useState(request.staffNotes || "")
  const [busy, setBusy] = useState(false)
  const changed = status !== request.status || notes !== (request.staffNotes || "")

  async function save() {
    setBusy(true)
    try {
      await medicineRequestsApi.update(request.id, { status, staffNotes: notes })
      toast.success("Medicine request updated")
      onSaved()
    } catch (err) { toast.error(apiErrorMessage(err)) } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words font-semibold">{request.medicineName}</h3>
              <Badge variant={request.status === "NEW" ? "default" : "secondary"}>{MEDICINE_REQUEST_LABELS[request.status]}</Badge>
            </div>
            <a className="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-4" href={`tel:${request.phone}`}><Phone className="h-3.5 w-3.5" aria-hidden />{request.phone}</a>
            <p className="text-xs text-muted-foreground"><time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time></p>
          </div>
          {request.photoUrl ? <a href={request.photoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-primary underline underline-offset-4">
            <img src={request.photoUrl} alt={`Photo for ${request.medicineName}`} loading="lazy" className="mb-1 h-24 w-24 rounded-lg border object-contain" />View photo
          </a> : <span className="text-xs text-muted-foreground">No photo attached</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <Label htmlFor={`request-status-${request.id}`}>Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as MedicineRequestStatus)} disabled={busy}>
              <SelectTrigger id={`request-status-${request.id}`}><SelectValue /></SelectTrigger>
              <SelectContent>{MEDICINE_REQUEST_STATUSES.map((value) => <SelectItem key={value} value={value}>{MEDICINE_REQUEST_LABELS[value]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`request-notes-${request.id}`}>Staff notes</Label>
            <Textarea id={`request-notes-${request.id}`} value={notes} onChange={(event) => setNotes(event.target.value)} disabled={busy} maxLength={1000} placeholder="Internal follow-up notes" rows={2} />
          </div>
        </div>
        <Button onClick={() => void save()} disabled={busy || !changed} size="sm" className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{busy ? "Saving…" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  )
}
