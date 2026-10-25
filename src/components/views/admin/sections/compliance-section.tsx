"use client"

// Compliance — PPB premise licence + superintendent pharmacist record, editable by
// ADMIN (pharmacists read-only). Empty state makes the PRD compliance rule explicit:
// no licence claim on the public site until the client provides their CURRENT licence
// (the 2024 record must not be published). Includes renewal countdown and a filtered
// audit trail of compliance/setting edits.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { adminApi, settingsApi } from "@/lib/api-client"
import type { AuditLogDTO, ComplianceInfo } from "@/lib/types"
import { formatDate, formatDateTime, timeAgo } from "@/lib/format"
import { useAuthStore } from "@/store/use-auth-store"
import { toast } from "sonner"
import { AdminSectionHeader, apiErrorMessage, SectionError, type SectionProps } from "../admin-shared"
import { ShieldCheck, CalendarClock, UserCog, Save, Loader2, Info, FileText, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"

const EMPTY_COMPLIANCE: ComplianceInfo = {
  premiseLicenceNumber: "",
  premiseLicenceExpiry: "",
  superintendentName: "",
  superintendentReg: "",
  notes: "",
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000)
}

function dateInputValue(raw: string): string {
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

export function ComplianceSection({ refreshKey, onRefresh }: SectionProps) {
  const role = useAuthStore((s) => s.session?.role)
  const isAdmin = role === "ADMIN"

  const [compliance, setCompliance] = useState<ComplianceInfo | null>(null)
  const [audit, setAudit] = useState<AuditLogDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<ComplianceInfo>(EMPTY_COMPLIANCE)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const settings = await settingsApi.get()
      const c = settings.compliance ?? EMPTY_COMPLIANCE
      setCompliance(c)
      setForm({
        ...c,
        premiseLicenceExpiry: dateInputValue(c.premiseLicenceExpiry ?? ""),
      })
      try {
        setAudit(await adminApi.audit())
      } catch {
        setAudit([])
      }
    } catch (err) {
      setError(apiErrorMessage(err))
      setCompliance(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const complianceAudit = useMemo(
    () =>
      audit
        .filter((entry) => {
          const entity = (entry.entity ?? "").toLowerCase()
          return entity.includes("setting") || entity.includes("compliance") || entity.includes("licence")
        })
        .slice(0, 5),
    [audit]
  )

  const hasLicence = Boolean(compliance?.premiseLicenceNumber?.trim())
  const expiryDays = compliance ? daysUntil(compliance.premiseLicenceExpiry ?? "") : null

  async function save() {
    setSaving(true)
    try {
      await settingsApi.update({
        compliance: {
          ...form,
          premiseLicenceExpiry: form.premiseLicenceExpiry || "",
        },
      })
      toast.success("Compliance details saved — the storefront licence notice updates accordingly.")
      setCompliance({ ...form })
      await load()
      onRefresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  if (error || !compliance) {
    return <SectionError message={error ?? "Compliance settings unavailable."} onRetry={() => void load()} />
  }

  const dirty = JSON.stringify({ ...form }) !== JSON.stringify({ ...compliance, premiseLicenceExpiry: dateInputValue(compliance.premiseLicenceExpiry) })

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Compliance"
        subtitle="PPB licence record and superintendent pharmacist details. Licence info is only published once verified."
      />

      {/* empty state / PRD note */}
      {!hasLicence ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>No current licence on file</AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-300">
            The public site correctly shows <span className="font-semibold">no licence claim</span> right now — the
            2024 record must not be published. Add the details below once the client provides their current PPB
            licence, and the storefront footer will update automatically.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* renewal reminder + superintendent */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden /> Licence &amp; renewal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Premise licence</span>
              <span className="font-mono text-sm font-semibold">{compliance.premiseLicenceNumber || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Expires</span>
              <span className="text-sm font-semibold">
                {compliance.premiseLicenceExpiry ? formatDate(compliance.premiseLicenceExpiry) : "—"}
              </span>
            </div>
            {expiryDays !== null ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Renewal</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-xs font-semibold",
                    expiryDays < 0
                      ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                      : expiryDays < 30
                        ? "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                        : expiryDays < 60
                          ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  )}
                >
                  {expiryDays < 0 ? `Expired ${Math.abs(expiryDays)}d ago` : `Renews in ${expiryDays} days`}
                </Badge>
              </div>
            ) : null}
            {compliance.notes ? (
              <p className="rounded-lg bg-muted/50 p-2.5 text-xs">{compliance.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <UserCog className="h-4 w-4 text-muted-foreground" aria-hidden /> Superintendent pharmacist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Name</span>
              <span className="text-sm font-semibold">{compliance.superintendentName || "—"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">PPB registration</span>
              <span className="font-mono text-sm font-semibold">{compliance.superintendentReg || "—"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              The superintendent is responsible for pharmacy practice standards and dispensing sign-off.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* editable form */}
      {isAdmin ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden /> Licence details (admin only)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-licence">Premise licence number</Label>
                <Input
                  id="c-licence"
                  value={form.premiseLicenceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, premiseLicenceNumber: e.target.value }))}
                  placeholder="e.g. PPB/PT/2025/XXXXX"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-expiry">Licence expiry</Label>
                <Input
                  id="c-expiry"
                  type="date"
                  value={form.premiseLicenceExpiry}
                  onChange={(e) => setForm((f) => ({ ...f, premiseLicenceExpiry: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-super">Superintendent name</Label>
                <Input
                  id="c-super"
                  value={form.superintendentName}
                  onChange={(e) => setForm((f) => ({ ...f, superintendentName: e.target.value }))}
                  placeholder="e.g. Dr. Jane Mwangi"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-reg">Superintendent PPB reg</Label>
                <Input
                  id="c-reg"
                  value={form.superintendentReg}
                  onChange={(e) => setForm((f) => ({ ...f, superintendentReg: e.target.value }))}
                  placeholder="e.g. PPB/RPH/XXXXX"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="c-notes">Notes</Label>
                <Textarea
                  id="c-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Renewal application submitted 12 Jan; awaiting PPB confirmation."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5" aria-hidden />
                All compliance edits are audit-logged{dirty ? " — you have unsaved changes" : ""}.
              </p>
              <Button onClick={() => void save()} disabled={saving || !dirty}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
                Save compliance details
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
          View-only — only admins can edit licence details. Ask an admin to update them.
        </p>
      )}

      {/* audit trail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden /> Compliance audit trail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {complianceAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No compliance edits recorded yet — changes will appear here with actor and timestamp.
            </p>
          ) : (
            <ul className="divide-y">
              {complianceAudit.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs">
                      <span className="font-semibold">{entry.actor}</span>
                      <span className="text-muted-foreground"> {entry.action.toLowerCase()}</span>
                    </p>
                    {entry.details ? <p className="truncate text-xs text-muted-foreground">{entry.details}</p> : null}
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
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
