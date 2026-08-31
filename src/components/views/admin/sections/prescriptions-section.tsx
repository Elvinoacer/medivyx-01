"use client"

// Prescriptions — compliance-critical review queue (PENDING first, then clarification
// requested, then others), full review dialog (image/PDF, customer notes, linked order
// items with Rx flags) and reviewed history with reviewer details.
// Review actions: Approve (refills + validity), Reject (reason required),
// Request clarification (message required), Partially approve (unavailable items noted).

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState, SectionHeader } from "@/components/shared/empty-state"
import { RxStatusBadge } from "@/components/shared/status-badges"
import { ordersApi, prescriptionsApi } from "@/lib/api-client"
import type { OrderDTO, PrescriptionDTO } from "@/lib/types"
import { RX_STATUS_LABELS, RX_STATUSES, type RxStatus } from "@/lib/constants"
import { formatDate, formatDateTime, formatKES, timeAgo } from "@/lib/format"
import { useAuthStore } from "@/store/use-auth-store"
import { toast } from "sonner"
import { apiErrorMessage, telHref, waHref, type SectionProps } from "../admin-shared"
import {
  ShieldAlert, Loader2, FileText, Download, Phone, MessageCircle, Eye,
  CheckCircle2, XCircle, HelpCircle, ListChecks, History, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

type ReviewAction = "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" | "PARTIALLY_APPROVED"

const VALID_DAYS_OPTIONS = [30, 60, 90, 180] as const

const queueOrder: Record<RxStatus, number> = {
  PENDING: 0,
  CLARIFICATION_REQUESTED: 1,
  PARTIALLY_APPROVED: 2,
  APPROVED: 3,
  REJECTED: 4,
}

export function PrescriptionsSection({ refreshKey, onRefresh }: SectionProps) {
  const role = useAuthStore((s) => s.session?.role)
  const canReview = role === "ADMIN" || role === "PHARMACIST"

  const [all, setAll] = useState<PrescriptionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<string>("ALL")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await prescriptionsApi.queue()
      setAll(list)
    } catch (err) {
      setError(apiErrorMessage(err))
      setAll([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const queue = useMemo(
    () =>
      all
        .filter((rx) => rx.status === "PENDING" || rx.status === "CLARIFICATION_REQUESTED")
        .sort((a, b) => queueOrder[a.status] - queueOrder[b.status] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [all]
  )
  const history = useMemo(
    () =>
      all
        .filter((rx) => rx.status !== "PENDING")
        .filter((rx) => (historyFilter === "ALL" ? true : rx.status === historyFilter))
        .sort((a, b) => new Date(b.reviewedAt ?? b.createdAt).getTime() - new Date(a.reviewedAt ?? a.createdAt).getTime()),
    [all, historyFilter]
  )
  const pendingCount = queue.filter((rx) => rx.status === "PENDING").length
  const clarificationCount = queue.length - pendingCount

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Prescription review"
        subtitle="Verify uploaded prescriptions before dispensing — approvals, rejections and refill counts are audit-logged."
      />

      {/* PHI reminder */}
      <div
        className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
        role="note"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          <span className="font-semibold">Confidential patient information.</span> Prescription images are
          confidential — only review on trusted devices, and never share them outside the dispensing workflow.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          <p className="font-semibold">Couldn&apos;t load the prescription queue</p>
          <p className="mt-0.5">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void load()}>Retry</Button>
        </div>
      ) : null}

      <Tabs defaultValue="queue">
        <TabsList>
          <TabsTrigger value="queue" className="gap-1.5">
            Review queue
            {pendingCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {pendingCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" aria-hidden /> Reviewed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-7 w-24" />
                </CardContent>
              </Card>
            ))
          ) : queue.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Queue is clear"
              description="No prescriptions waiting for review. New uploads appear here the moment customers submit them."
            />
          ) : (
            queue.map((rx) => <QueueCard key={rx.id} rx={rx} onReview={() => setReviewId(rx.id)} canReview={canReview} />)
          )}
          {!loading && clarificationCount > 0 && pendingCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {clarificationCount} awaiting customer clarification — follow up by phone or WhatsApp if needed.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">{history.length} reviewed prescription{history.length === 1 ? "" : "s"}</p>
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-48" aria-label="Filter reviewed prescriptions by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All outcomes</SelectItem>
                {RX_STATUSES.filter((s) => s !== "PENDING").map((s) => (
                  <SelectItem key={s} value={s}>{RX_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : history.length === 0 ? (
            <EmptyState
              icon={History}
              title="No reviewed prescriptions yet"
              description="Completed reviews will show here with reviewer notes, refills and validity."
            />
          ) : (
            history.map((rx) => <HistoryCard key={rx.id} rx={rx} />)
          )}
        </TabsContent>
      </Tabs>

      {reviewId ? (
        <ReviewDialog
          rxId={reviewId}
          canReview={canReview}
          onClose={() => setReviewId(null)}
          onSubmitted={() => {
            setReviewId(null)
            void load()
            onRefresh() // linked order status + overview KPIs may have changed
          }}
        />
      ) : null}
    </div>
  )
}

// ---------- queue card ----------

function QueueCard({ rx, onReview, canReview }: { rx: PrescriptionDTO; onReview: () => void; canReview: boolean }) {
  const wa = waHref(rx.customerPhone, `Hello ${rx.customerName ?? "there"}, this is Sphere Pharmacy regarding your prescription upload (${rx.fileName}).`)
  const tel = telHref(rx.customerPhone)
  return (
    <Card className="card-lift">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          {rx.status === "PENDING" ? <Clock className="h-5 w-5" aria-hidden /> : <HelpCircle className="h-5 w-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{rx.customerName ?? "Standalone upload"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {rx.fileName} · uploaded {timeAgo(rx.createdAt)}
          </p>
          {rx.orderReference ? (
            <p className="truncate text-xs text-muted-foreground">Linked order: <span className="font-medium text-foreground">{rx.orderReference}</span></p>
          ) : null}
          {rx.notes ? <p className="mt-1 truncate text-xs italic text-muted-foreground">“{rx.notes}”</p> : null}
        </div>
        <RxStatusBadge status={rx.status} />
        <div className="flex items-center gap-1.5">
          {tel ? (
            <Button size="icon" variant="outline" className="h-9 w-9" asChild aria-label={`Call ${rx.customerName ?? "customer"}`}>
              <a href={tel}><Phone className="h-4 w-4" /></a>
            </Button>
          ) : null}
          {wa ? (
            <Button size="icon" variant="outline" className="h-9 w-9" asChild aria-label={`WhatsApp ${rx.customerName ?? "customer"}`}>
              <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" /></a>
            </Button>
          ) : null}
          <Button size="sm" onClick={onReview} disabled={!canReview} title={canReview ? undefined : "Only pharmacists and admins can review"}>
            <Eye className="mr-1.5 h-4 w-4" aria-hidden /> {canReview ? "Review" : "View"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- history card ----------

function HistoryCard({ rx }: { rx: PrescriptionDTO }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{rx.customerName ?? "Standalone upload"}</p>
          <RxStatusBadge status={rx.status} />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {rx.fileName}
          {rx.orderReference ? ` · order ${rx.orderReference}` : ""} · uploaded {timeAgo(rx.createdAt)}
        </p>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {rx.reviewedByName ? (
            <p><span className="font-medium text-foreground">Reviewed by:</span> {rx.reviewedByName}{rx.reviewedAt ? ` · ${formatDateTime(rx.reviewedAt)}` : ""}</p>
          ) : null}
          {rx.refillsAllowed > 0 ? (
            <p><span className="font-medium text-foreground">Refills:</span> {rx.refillsUsed} used of {rx.refillsAllowed} allowed</p>
          ) : (
            <p><span className="font-medium text-foreground">Refills:</span> none allowed</p>
          )}
          {rx.validUntil ? (
            <p><span className="font-medium text-foreground">Valid until:</span> {formatDate(rx.validUntil)}</p>
          ) : null}
        </div>
        {rx.reviewNotes ? (
          <p className="mt-2 rounded-lg bg-muted/50 p-2.5 text-xs">“{rx.reviewNotes}”</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------- review dialog ----------

function ReviewDialog({
  rxId,
  canReview,
  onClose,
  onSubmitted,
}: {
  rxId: string
  canReview: boolean
  onClose: () => void
  onSubmitted: () => void
}) {
  const [detail, setDetail] = useState<(PrescriptionDTO & { fileData?: string }) | null>(null)
  const [linkedOrder, setLinkedOrder] = useState<OrderDTO | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // review form state
  const [action, setAction] = useState<ReviewAction>("APPROVED")
  const [notes, setNotes] = useState("")
  const [unavailable, setUnavailable] = useState("")
  const [refills, setRefills] = useState("0")
  const [validDays, setValidDays] = useState<string>("30")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setDetailError(null)
    prescriptionsApi
      .get(rxId)
      .then(async (rx) => {
        if (cancelled) return
        setDetail(rx)
        setLoading(false)
        if (rx.orderId) {
          try {
            const order = await ordersApi.get(rx.orderId)
            if (!cancelled) setLinkedOrder(order)
          } catch {
            if (!cancelled) setLinkedOrder(null)
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        setDetailError(apiErrorMessage(err))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [rxId])

  const isImage = detail ? detail.fileType.startsWith("image") : false
  const imageSrc = detail?.fileData
    ? detail.fileData.startsWith("data:")
      ? detail.fileData
      : `data:${detail.fileType};base64,${detail.fileData}`
    : null

  function download() {
    if (!detail?.fileData) return
    const href = detail.fileData.startsWith("data:") ? detail.fileData : `data:${detail.fileType};base64,${detail.fileData}`
    const a = document.createElement("a")
    a.href = href
    a.download = detail.fileName || "prescription"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const notesRequired = action === "REJECTED" || action === "CLARIFICATION_REQUESTED" || action === "PARTIALLY_APPROVED"
  const notesValid = notes.trim().length >= 3
  const partialValid = action !== "PARTIALLY_APPROVED" || unavailable.trim().length >= 3
  const refillsNum = Math.max(0, Math.min(6, Number(refills) || 0))

  async function submit() {
    if (!detail) return
    setBusy(true)
    try {
      let reviewNotes = notes.trim()
      if (action === "PARTIALLY_APPROVED" && unavailable.trim()) {
        reviewNotes = reviewNotes
          ? `${reviewNotes} — unavailable items: ${unavailable.trim()}`
          : `Unavailable items: ${unavailable.trim()}`
      }
      await prescriptionsApi.review(detail.id, {
        status: action,
        reviewNotes: reviewNotes || undefined,
        refillsAllowed: action === "APPROVED" || action === "PARTIALLY_APPROVED" ? refillsNum : undefined,
        validDays: action === "APPROVED" || action === "PARTIALLY_APPROVED" ? Number(validDays) : undefined,
      })
      toast.success(
        action === "APPROVED" ? "Prescription approved — refills and validity recorded."
          : action === "REJECTED" ? "Prescription rejected — customer will be notified."
            : action === "CLARIFICATION_REQUESTED" ? "Clarification request sent to the customer."
              : "Partially approved — unavailable items noted."
      )
      onSubmitted()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const wa = detail ? waHref(detail.customerPhone, `Hello ${detail.customerName ?? "there"}, this is Sphere Pharmacy regarding your prescription upload (${detail.fileName}).`) : null
  const tel = detail ? telHref(detail.customerPhone) : null

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4 pb-3">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            {detail?.fileName ?? "Prescription"}
            {detail ? <RxStatusBadge status={detail.status} /> : null}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {detail
              ? `${detail.customerName ?? "Standalone upload"}${detail.customerPhone ? ` · ${detail.customerPhone}` : ""} · uploaded ${timeAgo(detail.createdAt)}`
              : "Loading prescription…"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="scroll-slim min-h-0 flex-1">
          <div className="space-y-4 p-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-64 w-full rounded-lg" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : detailError ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
                {detailError}
              </div>
            ) : detail ? (
              <>
                {/* document */}
                {imageSrc ? (
                  <figure className="overflow-hidden rounded-lg border bg-muted/30">
                    <img
                      src={imageSrc}
                      alt={`Uploaded prescription: ${detail.fileName}`}
                      className="max-h-80 w-full object-contain"
                    />
                    <figcaption className="flex items-center justify-between gap-2 border-t bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      <span>{detail.fileName}</span>
                      <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={download}>
                        <Download className="h-3.5 w-3.5" aria-hidden /> Download
                      </Button>
                    </figcaption>
                  </figure>
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-8 text-center">
                    <FileText className="h-10 w-10 text-muted-foreground" aria-hidden />
                    <div>
                      <p className="text-sm font-medium">PDF document</p>
                      <p className="text-xs text-muted-foreground">
                        {detail.fileName} · {detail.fileType || "application/pdf"}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={download}>
                      <Download className="h-3.5 w-3.5" aria-hidden /> Download to view
                    </Button>
                  </div>
                )}

                {/* customer notes + contact */}
                {detail.notes ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer notes</p>
                    <p className="rounded-lg border p-3 text-sm">“{detail.notes}”</p>
                  </div>
                ) : null}
                {tel || wa ? (
                  <div className="flex flex-wrap gap-2">
                    {tel ? (
                      <Button size="sm" variant="outline" className="gap-1.5" asChild>
                        <a href={tel}><Phone className="h-3.5 w-3.5" /> Call customer</a>
                      </Button>
                    ) : null}
                    {wa ? (
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" asChild>
                        <a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                {/* linked order */}
                {detail.orderId ? (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Linked order {detail.orderReference ? `· ${detail.orderReference}` : ""}
                    </p>
                    {linkedOrder ? (
                      <ul className="divide-y rounded-lg border">
                        {linkedOrder.items.map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-3 p-2.5">
                            <span className="min-w-0 truncate text-sm">
                              {item.name} <span className="text-xs text-muted-foreground">× {item.qty}</span>
                              {item.requiresPrescription ? <span className="ml-1.5 text-rose-600" aria-label="prescription item">℞</span> : null}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">{formatKES(item.lineTotal)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                        Linked order details unavailable{detail.orderReference ? ` (${detail.orderReference})` : ""}.
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Approving will let the linked order continue automatically — refill it from the Orders tab.
                    </p>
                  </div>
                ) : null}

                {/* review form */}
                {canReview && detail.status !== "APPROVED" ? (
                  <div className="space-y-3 rounded-lg border p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your review</p>
                    <RadioGroup value={action} onValueChange={(v) => setAction(v as ReviewAction)} className="gap-2">
                      <ReviewChoice value="APPROVED" icon={CheckCircle2} title="Approve" desc="Prescription is valid — allow dispensing." />
                      <ReviewChoice value="PARTIALLY_APPROVED" icon={ListChecks} title="Partially approve" desc="Some items can be dispensed; others unavailable." />
                      <ReviewChoice value="CLARIFICATION_REQUESTED" icon={HelpCircle} title="Request clarification" desc="Message the customer for missing details." />
                      <ReviewChoice value="REJECTED" icon={XCircle} title="Reject" desc="Prescription cannot be dispensed." />
                    </RadioGroup>

                    {action === "APPROVED" || action === "PARTIALLY_APPROVED" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="rx-refills">Refills allowed (0–6)</Label>
                          <Input
                            id="rx-refills"
                            type="number"
                            min={0}
                            max={6}
                            value={refills}
                            onChange={(e) => setRefills(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="rx-valid">Valid for</Label>
                          <Select value={validDays} onValueChange={setValidDays}>
                            <SelectTrigger id="rx-valid" aria-label="Prescription validity period">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VALID_DAYS_OPTIONS.map((d) => (
                                <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : null}

                    {action === "PARTIALLY_APPROVED" ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="rx-unavailable">Unavailable items (required)</Label>
                        <Input
                          id="rx-unavailable"
                          value={unavailable}
                          onChange={(e) => setUnavailable(e.target.value)}
                          placeholder="e.g. Ventolin inhaler 100mcg (out of stock)"
                        />
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label htmlFor="rx-notes">
                        {action === "CLARIFICATION_REQUESTED"
                          ? "Message to customer (required)"
                          : action === "REJECTED"
                            ? "Reason for rejection (required)"
                            : "Review notes (optional)"}
                      </Label>
                      <Textarea
                        id="rx-notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        placeholder={
                          action === "CLARIFICATION_REQUESTED"
                            ? "e.g. Please send a clearer photo of the prescription — the dosage is unreadable."
                            : action === "REJECTED"
                              ? "e.g. Prescription is expired (issued 2023)."
                              : "e.g. Verified against patient record; 1 refill authorised."
                        }
                        aria-invalid={notesRequired && !notesValid && notes.length > 0}
                      />
                      {notesRequired && !notesValid && notes.length > 0 ? (
                        <p className="text-xs text-rose-600">This field is required (min 3 characters).</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 p-4">
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          {canReview && detail && detail.status !== "APPROVED" ? (
            <Button onClick={() => void submit()} disabled={busy || (notesRequired && !notesValid) || !partialValid}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {action === "APPROVED" ? "Approve prescription"
                : action === "REJECTED" ? "Reject prescription"
                  : action === "CLARIFICATION_REQUESTED" ? "Send request"
                    : "Save partial approval"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReviewChoice({
  value,
  icon: Icon,
  title,
  desc,
}: {
  value: ReviewAction
  icon: typeof CheckCircle2
  title: string
  desc: string
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        "has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5" aria-label={title} />
      <span className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-muted-foreground">{desc}</span>
        </span>
      </span>
    </label>
  )
}
