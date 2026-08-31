"use client"

// Reviews — the moderation queue for product reviews. Staff can scan every
// customer review (stars, author, comment), filter by status and hide or
// restore them with an optimistic update. Hidden reviews disappear from the
// storefront product pages; published ones count towards the average rating.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState, SectionHeader } from "@/components/shared/empty-state"
import { StarRow } from "@/components/shared/product-card"
import { adminApi } from "@/lib/api-client"
import type { AdminReviewDTO } from "@/lib/types"
import { REVIEW_STATUS_LABELS, type ReviewStatus } from "@/lib/constants"
import { formatDate, timeAgo } from "@/lib/format"
import { toast } from "sonner"
import { apiErrorMessage, type SectionProps } from "../admin-shared"
import { Eye, EyeOff, Loader2, MessageSquareText, Star } from "lucide-react"
import { cn } from "@/lib/utils"

type FilterKey = "ALL" | ReviewStatus

// ---------- main section ----------

export function ReviewsSection({ refreshKey }: SectionProps) {
  const [reviews, setReviews] = useState<AdminReviewDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>("ALL")
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setReviews(await adminApi.reviews())
    } catch (err) {
      setError(apiErrorMessage(err))
      setReviews([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const counts = useMemo(() => {
    const all = reviews ?? []
    return {
      ALL: all.length,
      PUBLISHED: all.filter((r) => r.status === "PUBLISHED").length,
      HIDDEN: all.filter((r) => r.status === "HIDDEN").length,
    }
  }, [reviews])

  const visible = useMemo(
    () => (reviews ?? []).filter((r) => filter === "ALL" || r.status === filter),
    [reviews, filter]
  )

  async function setReviewStatus(review: AdminReviewDTO, status: ReviewStatus) {
    const prevStatus = review.status
    // optimistic flip
    setReviews((prev) =>
      prev ? prev.map((r) => (r.id === review.id ? { ...r, status } : r)) : prev
    )
    setBusyId(review.id)
    try {
      const saved = await adminApi.setReviewStatus(review.id, status)
      setReviews((prev) => (prev ? prev.map((r) => (r.id === saved.id ? saved : r)) : prev))
      toast.success(
        status === "HIDDEN"
          ? `Review hidden — no longer shown on ${review.productName}.`
          : `Review restored — visible on ${review.productName} again.`
      )
    } catch (err) {
      // revert on failure
      setReviews((prev) =>
        prev ? prev.map((r) => (r.id === review.id ? { ...r, status: prevStatus } : r)) : prev
      )
      toast.error(apiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Reviews"
        subtitle="Moderate customer product reviews — hidden reviews disappear from the storefront and rating averages."
      />

      {/* filter tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
        <TabsList>
          {(
            [
              ["ALL", "All"],
              ["PUBLISHED", "Published"],
              ["HIDDEN", "Hidden"],
            ] as const
          ).map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="gap-1.5">
              {label}
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] tabular-nums">
                {counts[key]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? <SectionErrorInline message={error} onRetry={() => void load()} /> : null}

      {reviews === null ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 p-4">
                  <Skeleton className="h-5 w-24" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={
            filter === "ALL"
              ? "No reviews yet"
              : filter === "HIDDEN"
                ? "No hidden reviews"
                : "No published reviews"
          }
          description={
            filter === "ALL"
              ? "Customer reviews on product pages will appear here for moderation."
              : `Switch filters to see the ${filter === "HIDDEN" ? "published" : "hidden"} reviews.`
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul
              className="scroll-slim max-h-[28rem] divide-y overflow-y-auto"
              aria-label="Product reviews moderation list"
            >
              {visible.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  busy={busyId === review.id}
                  onHide={() => void setReviewStatus(review, "HIDDEN")}
                  onRestore={() => void setReviewStatus(review, "PUBLISHED")}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <Star className="mr-1 inline h-3.5 w-3.5 text-amber-500" aria-hidden />
        Storefront averages and review counts include published reviews only — your own hidden
        review stays visible to you on the product page.
      </p>
    </div>
  )
}

// ---------- single review row ----------

function ReviewRow({
  review,
  busy,
  onHide,
  onRestore,
}: {
  review: AdminReviewDTO
  busy: boolean
  onHide: () => void
  onRestore: () => void
}) {
  const hidden = review.status === "HIDDEN"
  const contact =
    review.authorEmail ?? review.authorPhone ?? null

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
      {/* rating + product */}
      <div className="min-w-0 space-y-1 sm:w-56 sm:shrink-0">
        <StarRow value={review.rating} />
        <p className="truncate text-sm font-semibold" title={review.productName}>
          {review.productName}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{review.productSku}</p>
      </div>

      {/* author + comment */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{review.authorName}</span>
          {contact ? <span className="truncate">{contact}</span> : null}
          <span aria-hidden>·</span>
          <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
          <span aria-hidden>·</span>
          <span>{timeAgo(review.createdAt)}</span>
        </p>
        {review.comment ? (
          <p className="line-clamp-2 text-sm" title={review.comment}>
            {review.comment}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">No comment — rating only.</p>
        )}
      </div>

      {/* status + action */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        <Badge
          variant="outline"
          className={cn(
            hidden
              ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          )}
        >
          {REVIEW_STATUS_LABELS[review.status]}
        </Badge>
        {hidden ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onRestore}
            disabled={busy}
            aria-label={`Restore review of ${review.productName} by ${review.authorName}`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
            Restore
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
            onClick={onHide}
            disabled={busy}
            aria-label={`Hide review of ${review.productName} by ${review.authorName}`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
            Hide
          </Button>
        )}
      </div>
    </li>
  )
}

// ---------- inline error (compact variant of SectionError) ----------

function SectionErrorInline({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
      role="alert"
    >
      <p className="font-semibold">Couldn&apos;t load reviews</p>
      <p className="mt-0.5">{message}</p>
      <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
