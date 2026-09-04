"use client"

// Promotions — card grid with live preview of how each banner renders on the
// storefront, active toggle, create/edit dialog (title, badge, description, code,
// discount %, colour, schedule) and delete with confirmation.

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState, SectionHeader } from "@/components/shared/empty-state"
import { promotionsApi } from "@/lib/api-client"
import type { PromotionDTO } from "@/lib/types"
import { formatDate } from "@/lib/format"
import { toast } from "sonner"
import { apiErrorMessage, type SectionProps } from "../admin-shared"
import { Megaphone, Loader2, Plus, Pencil, Trash2, Ticket, CalendarDays, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

// Preset colour themes (mirrors storefront banner colours; no indigo/blue per theme rules)
const COLOR_PRESETS = ["teal", "emerald", "amber", "orange", "rose", "violet", "neutral"] as const
type ColorPreset = (typeof COLOR_PRESETS)[number]

const colorChipClass: Record<ColorPreset, string> = {
  teal: "bg-teal-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  neutral: "bg-slate-400",
}

const bannerClass: Record<ColorPreset, string> = {
  teal: "bg-teal-600 text-white",
  emerald: "bg-emerald-600 text-white",
  amber: "bg-amber-500 text-amber-950",
  orange: "bg-orange-600 text-white",
  rose: "bg-rose-600 text-white",
  violet: "bg-violet-600 text-white",
  neutral: "bg-slate-700 text-white",
}

function colorOf(raw: string | null | undefined): ColorPreset {
  const c = (raw ?? "").toLowerCase()
  return (COLOR_PRESETS as readonly string[]).includes(c) ? (c as ColorPreset) : "teal"
}

function dateValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

export function PromotionsSection({ refreshKey, onRefresh }: SectionProps) {
  const [promos, setPromos] = useState<PromotionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; promo?: PromotionDTO } | null>(null)
  const [deleteFor, setDeleteFor] = useState<PromotionDTO | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await promotionsApi.list(true)
      setPromos(list)
    } catch (err) {
      setError(apiErrorMessage(err))
      setPromos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function patchPromo(id: string, data: Partial<PromotionDTO>, successMsg: string) {
    setBusyId(id)
    try {
      const updated = await promotionsApi.update(id, data)
      setPromos((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)))
      toast.success(successMsg)
      onRefresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const activeCount = promos.filter((p) => p.active).length

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Promotions"
        subtitle={`${activeCount} active campaign${activeCount === 1 ? "" : "s"} — banners and codes appear on the storefront homepage.`}
        action={
          <Button className="gap-1.5" onClick={() => setEditor({ mode: "create" })}>
            <Plus className="h-4 w-4" /> New promotion
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          <p className="font-semibold">Couldn&apos;t load promotions</p>
          <p className="mt-0.5">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void load()}>Retry</Button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : promos.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No promotions yet"
          description="Create a banner or promo code to highlight offers on the storefront homepage."
          action={{ label: "New promotion", onClick: () => setEditor({ mode: "create" }) }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {promos.map((promo) => {
            const color = colorOf(promo.color)
            return (
              <Card key={promo.id} className="card-lift flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  {/* storefront preview */}
                  <div
                    className={cn("relative flex flex-col gap-1 overflow-hidden rounded-lg p-3.5", bannerClass[color])}
                    aria-label={`Storefront preview of ${promo.title}`}
                  >
                    <div className="flex items-center gap-2">
                      {promo.badge ? (
                        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                          {promo.badge}
                        </span>
                      ) : null}
                      {promo.discountPct ? (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                          -{promo.discountPct}%
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-bold leading-snug">{promo.title || "Untitled promotion"}</p>
                    <p className="line-clamp-2 text-xs opacity-90">{promo.description}</p>
                    {promo.code ? (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                        <Ticket className="h-3.5 w-3.5" aria-hidden />
                        Code <span className="rounded bg-white/25 px-1.5 py-0.5 font-mono tracking-wider">{promo.code}</span>
                      </p>
                    ) : null}
                  </div>

                  {/* meta + controls */}
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      {promo.startsAt || promo.endsAt
                        ? `${promo.startsAt ? formatDate(promo.startsAt) : "—"} → ${promo.endsAt ? formatDate(promo.endsAt) : "no end"}`
                        : "Always on (no schedule)"}
                    </span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] capitalize">
                      <span className={cn("mr-1 inline-block h-2 w-2 rounded-full", colorChipClass[color])} aria-hidden />
                      {color}
                    </Badge>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                      <Switch
                        checked={promo.active}
                        disabled={busyId === promo.id}
                        onCheckedChange={(checked) => void patchPromo(promo.id, { active: checked }, checked ? `${promo.title} is now live.` : `${promo.title} paused.`)}
                        aria-label={`Toggle ${promo.title} on the storefront`}
                      />
                      {busyId === promo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : promo.active ? "Live" : "Paused"}
                    </label>
                    <div className="flex items-center gap-1">
                      {promo.code ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            void navigator.clipboard?.writeText(promo.code!)
                            toast.success(`Code ${promo.code} copied.`)
                          }}
                          aria-label={`Copy code ${promo.code}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditor({ mode: "edit", promo })} aria-label={`Edit ${promo.title}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                        onClick={() => setDeleteFor(promo)}
                        aria-label={`Delete ${promo.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* editor */}
      {editor ? (
        <PromotionEditorDialog
          mode={editor.mode}
          promo={editor.promo}
          onClose={() => setEditor(null)}
          onSaved={(saved, wasCreate) => {
            setEditor(null)
            setPromos((list) =>
              wasCreate ? [saved, ...list] : list.map((p) => (p.id === saved.id ? { ...p, ...saved } : p))
            )
            onRefresh()
          }}
        />
      ) : null}

      {/* delete */}
      {deleteFor ? (
        <Dialog open onOpenChange={(open) => !open && !deleteBusy && setDeleteFor(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" aria-hidden /> Delete promotion?
              </DialogTitle>
              <DialogDescription>
                “{deleteFor.title}” will be removed permanently. Pausing it instead keeps it available for later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setDeleteFor(null)} disabled={deleteBusy}>Keep it</Button>
              <Button
                variant="destructive"
                disabled={deleteBusy}
                onClick={async () => {
                  if (!deleteFor) return
                  setDeleteBusy(true)
                  try {
                    await promotionsApi.remove(deleteFor.id)
                    toast.success(`${deleteFor.title} deleted.`)
                    setPromos((list) => list.filter((p) => p.id !== deleteFor.id))
                    setDeleteFor(null)
                    onRefresh()
                  } catch (err) {
                    toast.error(apiErrorMessage(err))
                  } finally {
                    setDeleteBusy(false)
                  }
                }}
              >
                {deleteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Delete promotion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

// ---------- editor dialog ----------

interface PromoForm {
  title: string
  badge: string
  description: string
  code: string
  discountPct: string
  color: ColorPreset
  active: boolean
  startsAt: string
  endsAt: string
}

function PromotionEditorDialog({
  mode,
  promo,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  promo?: PromotionDTO
  onClose: () => void
  onSaved: (saved: PromotionDTO, wasCreate: boolean) => void
}) {
  const [form, setForm] = useState<PromoForm>({
    title: promo?.title ?? "",
    badge: promo?.badge ?? "",
    description: promo?.description ?? "",
    code: promo?.code ?? "",
    discountPct: promo?.discountPct ? String(promo.discountPct) : "",
    color: colorOf(promo?.color),
    active: promo?.active ?? true,
    startsAt: dateValue(promo?.startsAt),
    endsAt: dateValue(promo?.endsAt),
  })
  const [busy, setBusy] = useState(false)

  const valid = form.title.trim().length >= 2 && form.description.trim().length >= 2

  async function save() {
    setBusy(true)
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        badge: form.badge.trim() || null,
        code: form.code.trim().toUpperCase() || null,
        discountPct: form.discountPct.trim() ? Math.max(0, Math.min(90, Number(form.discountPct))) : null,
        color: form.color,
        active: form.active,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      }
      const saved =
        mode === "create" ? await promotionsApi.create(payload) : await promotionsApi.update(promo!.id, payload)
      toast.success(mode === "create" ? `${saved.title} created.` : `${saved.title} updated.`)
      onSaved(saved, mode === "create")
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[46rem] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-full">
        <DialogHeader className="shrink-0 border-b p-4 pb-3 pr-12 text-left">
          <DialogTitle>{mode === "create" ? "New promotion" : `Edit “${promo?.title}”`}</DialogTitle>
          <DialogDescription>
            Banners show on the storefront homepage; codes apply at checkout once the backend promo engine lands.
          </DialogDescription>
        </DialogHeader>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain" tabIndex={0} aria-label="Promotion details">
          <div className="space-y-4 p-3 sm:p-4">
            {/* live preview */}
            <div className={cn("min-w-0 rounded-lg p-3.5", bannerClass[form.color])} aria-label="Live storefront preview">
              <div className="flex flex-wrap items-center gap-2">
                {form.badge ? (
                  <span className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{form.badge}</span>
                ) : null}
                {form.discountPct && Number(form.discountPct) > 0 ? (
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-900">-{Number(form.discountPct)}%</span>
                ) : null}
              </div>
              <p className="break-words text-sm font-bold">{form.title || "Your promotion title"}</p>
              <p className="break-words text-xs opacity-90">{form.description || "A short customer-facing description of the offer."}</p>
              {form.code ? (
                <p className="mt-1 text-xs font-semibold">Code: <span className="rounded bg-white/25 px-1.5 py-0.5 font-mono tracking-wider">{form.code.toUpperCase()}</span></p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pr-title">Title *</Label>
                <Input id="pr-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Cold & flu season — 15% off" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-badge">Badge</Label>
                <Input id="pr-badge" value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} placeholder="e.g. Season offer" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-code">Promo code</Label>
                <Input id="pr-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. FLU15" className="font-mono uppercase" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pr-desc">Description *</Label>
                <Textarea id="pr-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="Shown under the banner title" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-discount">Discount % (optional)</Label>
                <Input id="pr-discount" type="number" min={0} max={90} value={form.discountPct} onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))} placeholder="15" />
              </div>
              <div className="space-y-1.5">
                <Label>Colour theme</Label>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Banner colour theme">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Use ${c} theme`}
                      aria-pressed={form.color === c}
                      onClick={() => setForm((f) => ({ ...f, color: c }))}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 sm:h-9 sm:w-9 sm:hover:scale-110",
                        form.color === c ? "border-foreground" : "border-transparent"
                      )}
                    >
                      <span className={cn("h-6 w-6 rounded-full", colorChipClass[c])} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-start">Starts</Label>
                <Input id="pr-start" type="date" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pr-end">Ends</Label>
                <Input id="pr-end" type="date" value={form.endsAt} onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
                <div>
                  <Label htmlFor="pr-active" className="text-sm">Live on storefront</Label>
                  <p className="text-xs text-muted-foreground">Turn off to pause without deleting.</p>
                </div>
                <Switch id="pr-active" checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t bg-background p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:bg-muted/30 sm:p-4">
          <Button className="w-full sm:w-auto" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="w-full sm:w-auto" onClick={() => void save()} disabled={busy || !valid}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === "create" ? "Create promotion" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
