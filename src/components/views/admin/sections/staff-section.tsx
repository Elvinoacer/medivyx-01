"use client"

// Staff (ADMIN only) — team table with role badges, active toggle (can't disable
// yourself), add/edit dialogs with password generator, delete with confirmation,
// and role description helper text.

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { adminApi } from "@/lib/api-client"
import type { StaffDTO } from "@/lib/types"
import { ROLES, ROLE_LABELS, type Role } from "@/lib/constants"
import { formatDate, initials } from "@/lib/format"
import { useAuthStore } from "@/store/use-auth-store"
import { toast } from "sonner"
import { AdminSectionHeader, apiErrorMessage, type SectionProps } from "../admin-shared"
import { Users, Loader2, Plus, Pencil, Trash2, Dices, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

const roleBadgeClass: Record<Role, string> = {
  ADMIN: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  PHARMACIST: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  STAFF: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  RIDER: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800",
}

const ROLE_HELP: Record<Role, string> = {
  ADMIN: "Full access — every section, staff management, settings, compliance and reports.",
  PHARMACIST: "Overview, orders, prescription review and catalogue. Signs off dispensing decisions.",
  STAFF: "Overview, orders, catalogue and promotions. Day-to-day counter and dispatch work.",
  RIDER: "Overview and delivery-focused orders only (out-for-delivery queue and confirmations).",
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let out = ""
  const rand = new Uint32Array(10)
  crypto.getRandomValues(rand)
  for (let i = 0; i < 10; i++) out += chars[rand[i] % chars.length]
  return out
}

export function StaffSection({ refreshKey, onRefresh }: SectionProps) {
  const selfId = useAuthStore((s) => s.session?.staff?.id)
  const [staff, setStaff] = useState<StaffDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ mode: "create" | "edit"; member?: StaffDTO } | null>(null)
  const [deleteFor, setDeleteFor] = useState<StaffDTO | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await adminApi.staff()
      setStaff(list)
    } catch (err) {
      setError(apiErrorMessage(err))
      setStaff([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function setActive(member: StaffDTO, active: boolean) {
    if (member.id === selfId && !active) {
      toast.error("You can't deactivate your own account while signed in.")
      return
    }
    setBusyId(member.id)
    try {
      const updated = await adminApi.updateStaff(member.id, { active })
      setStaff((list) => list.map((s) => (s.id === member.id ? { ...s, ...updated } : s)))
      toast.success(active ? `${member.name} reactivated.` : `${member.name} deactivated — they can no longer sign in.`)
      onRefresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <AdminSectionHeader
        title="Staff & access"
        subtitle="Team members, roles and sign-in status. Staff sign in with email + password."
        action={
          <Button className="gap-1.5" onClick={() => setEditor({ mode: "create" })}>
            <Plus className="h-4 w-4" /> Add staff
          </Button>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          <p className="font-semibold">Couldn&apos;t load the team</p>
          <p className="mt-0.5">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void load()}>Retry</Button>
        </div>
      ) : null}

      {/* role reference */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden /> What each role can access
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {ROLES.map((role) => (
              <div key={role} className="rounded-lg border p-2.5">
                <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", roleBadgeClass[role])}>{ROLE_LABELS[role]}</Badge>
                <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : staff.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff accounts"
          description="Add your first team member — admins, pharmacists, counter staff and riders."
          action={{ label: "Add staff", onClick: () => setEditor({ mode: "create" }) }}
        />
      ) : (
        <Card className="overflow-hidden">
          <ScrollArea className="scroll-slim">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => {
                  const isSelf = member.id === selfId
                  return (
                    <TableRow key={member.id} className={cn(!member.active && "opacity-60")}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className={cn("text-xs font-bold", isSelf ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                              {initials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold">
                              {member.name}
                              {isSelf ? <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">(you)</span> : null}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="max-w-44 truncate text-xs">{member.email}</p>
                        <p className="text-xs text-muted-foreground">{member.phone ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("px-1.5 py-0 text-[10px]", roleBadgeClass[member.role])}>
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-36 truncate text-xs text-muted-foreground">{member.title ?? "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(member.createdAt)}</TableCell>
                      <TableCell className="text-center">
                        {busyId === member.id ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                        ) : (
                          <Switch
                            checked={member.active}
                            disabled={isSelf}
                            onCheckedChange={(checked) => void setActive(member, checked)}
                            aria-label={`Toggle active status for ${member.name}`}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditor({ mode: "edit", member })} aria-label={`Edit ${member.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                            onClick={() => setDeleteFor(member)}
                            disabled={isSelf}
                            aria-label={`Delete ${member.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {staff.filter((s) => s.active).length} active of {staff.length} — deactivating blocks sign-in but keeps audit history.
          </p>
        </Card>
      )}

      {/* editor */}
      {editor ? (
        <StaffEditorDialog
          mode={editor.mode}
          member={editor.member}
          onClose={() => setEditor(null)}
          onSaved={(saved, wasCreate) => {
            setEditor(null)
            setStaff((list) =>
              wasCreate ? [...list, saved] : list.map((s) => (s.id === saved.id ? { ...s, ...saved } : s))
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
                <Trash2 className="h-4 w-4 text-rose-600" aria-hidden /> Remove {deleteFor.name}?
              </DialogTitle>
              <DialogDescription>
                The account will be deleted permanently. Deactivating instead keeps their audit trail and order
                history intact — usually the safer choice.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setDeleteFor(null)} disabled={deleteBusy}>Keep account</Button>
              <Button
                variant="destructive"
                disabled={deleteBusy}
                onClick={async () => {
                  if (!deleteFor) return
                  setDeleteBusy(true)
                  try {
                    await adminApi.deleteStaff(deleteFor.id)
                    toast.success(`${deleteFor.name} removed from the team.`)
                    setStaff((list) => list.filter((s) => s.id !== deleteFor.id))
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
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

// ---------- staff editor dialog ----------

interface StaffForm {
  name: string
  email: string
  phone: string
  role: Role
  title: string
  password: string
}

function StaffEditorDialog({
  mode,
  member,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  member?: StaffDTO
  onClose: () => void
  onSaved: (saved: StaffDTO, wasCreate: boolean) => void
}) {
  const [form, setForm] = useState<StaffForm>({
    name: member?.name ?? "",
    email: member?.email ?? "",
    phone: member?.phone ?? "",
    role: member?.role ?? "STAFF",
    title: member?.title ?? "",
    password: "",
  })
  const [busy, setBusy] = useState(false)

  const valid =
    form.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    (mode === "edit" || form.password.length >= 6)

  async function save() {
    setBusy(true)
    try {
      const saved =
        mode === "create"
          ? await adminApi.createStaff({
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              phone: form.phone.trim() || undefined,
              role: form.role,
              title: form.title.trim() || undefined,
              password: form.password,
            })
          : await adminApi.updateStaff(member!.id, {
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              phone: form.phone.trim() || undefined,
              role: form.role,
              title: form.title.trim() || undefined,
              ...(form.password.length >= 6 ? { password: form.password } : {}),
            })
      toast.success(
        mode === "create"
          ? `${saved.name} added as ${ROLE_LABELS[form.role]}. Share their password securely.`
          : form.password.length >= 6
            ? `${saved.name} updated (password reset).`
            : `${saved.name} updated.`
      )
      onSaved(saved, mode === "create")
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add staff member" : `Edit ${member?.name}`}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "They'll sign in with this email and password at the staff sign-in screen."
              : "Leave the password blank to keep their current password."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="st-name">Full name *</Label>
            <Input id="st-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Amina Wanjiru" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-email">Email *</Label>
            <Input id="st-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@spherepharmacy.co.ke" />
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-phone">Phone</Label>
              <Input id="st-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+254 7XX XXX XXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-title">Job title</Label>
              <Input id="st-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Superintendent Pharmacist" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-role">Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
              <SelectTrigger id="st-role" aria-label="Staff role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HELP[form.role]}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-password" className="flex items-center justify-between">
              <span>{mode === "create" ? "Password *" : "Reset password (optional)"}</span>
              <button
                type="button"
                className="flex items-center gap-1 text-xs font-normal text-primary hover:underline"
                onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
              >
                <Dices className="h-3 w-3" aria-hidden /> Generate
              </button>
            </Label>
            <Input
              id="st-password"
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder={mode === "create" ? "Min 6 characters — or click Generate" : "Leave blank to keep current"}
              className="font-mono"
              autoComplete="new-password"
            />
            {form.password.length > 0 && form.password.length < 6 ? (
              <p className="text-xs text-rose-600">Password must be at least 6 characters.</p>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !valid}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === "create" ? "Add staff member" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
