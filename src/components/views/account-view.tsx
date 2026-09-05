"use client"

import { MemberIntro } from "@/components/member/member-intro"

import { useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Check, CheckCircle2, ChevronRight, Clock, Eye, Heart, HelpCircle } from "lucide-react"
import { enablePushNotifications, disablePushNotifications } from "@/lib/firebase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { addressesApi, authApi, catalogApi, notificationsApi, ordersApi, storageApi } from "@/lib/api-client"
import { DELIVERY_DEFAULTS, LOYALTY, ROLE_LABELS } from "@/lib/constants"
import { formatDate, formatKES, initials, statusLabel, timeAgo } from "@/lib/format"
import type { AddressDTO, LoyaltySummaryDTO, NotificationDTO, NotificationPrefsDTO, StockAlertDTO } from "@/lib/types"
import { toast } from "sonner"
import { UseCurrentLocationButton } from "@/components/shared/use-current-location-button"
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BellOff,
  BellRing,
  Briefcase,
  Camera,
  CheckCheck,
  Download,
  FileText,
  History,
  Home,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  PackageSearch,
  Phone,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ---------- local helpers ----------

function errMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^254[17]\d{8}$/.test(digits)) return digits
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`
  return null
}

function labelIcon(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes("home") || l.includes("house")) return Home
  if (l.includes("work") || l.includes("office") || l.includes("job")) return Briefcase
  return MapPin
}

interface ProfileForm {
  name: string
  phone: string
  email: string
  avatar: string | null
}

interface PasswordForm {
  current: string
  next: string
  confirm: string
}

interface AddressForm {
  label: string
  text: string
  area: string
  notes: string
  isDefault: boolean
  latitude: number | null
  longitude: number | null
}

const EMPTY_ADDRESS_FORM: AddressForm = {
  label: "Home",
  text: "",
  area: "",
  notes: "",
  isDefault: false,
  latitude: null,
  longitude: null,
}

const ZONE_NAMES = DELIVERY_DEFAULTS.zones.map((z) => z.name.trim())

// ============================== VIEW ==============================

export function AccountView() {
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const refreshSession = useAuthStore((s) => s.refresh)
  const logout = useAuthStore((s) => s.logout)

  const user = session?.user ?? null
  const isCustomer = session?.role === "CUSTOMER"
  const isStaff = session != null && session.role !== "CUSTOMER"

  // ---------- profile ----------
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({ name: "", phone: "", email: "", avatar: null })
  const [profileError, setProfileError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const res = await storageApi.uploadFile(file, "avatars")
      setProfileForm((f) => ({ ...f, avatar: res.url }))
      await authApi.updateProfile({ avatar: res.url })
      await refreshSession()
      toast.success("Profile photo uploaded to Cloudflare R2!")
    } catch (err) {
      toast.error(errMessage(err, "Failed to upload profile photo."))
    } finally {
      setUploadingAvatar(false)
      if (e.target) e.target.value = ""
    }
  }

  function startEditProfile() {
    setProfileForm({
      name: user?.name ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      avatar: user?.avatar ?? null,
    })
    setProfileError(null)
    setEditingProfile(true)
  }

  async function saveProfile() {
    const name = profileForm.name.trim()
    const phone = profileForm.phone.trim()
    const email = profileForm.email.trim()
    if (name.length < 2) {
      setProfileError("Please enter your full name (at least 2 characters).")
      return
    }
    if (phone && !normalizePhone(phone)) {
      setProfileError("Enter a valid Kenyan phone number, e.g. 0712 345 678.")
      return
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      setProfileError("Enter a valid email address.")
      return
    }
    setSavingProfile(true)
    setProfileError(null)
    try {
      await authApi.updateProfile({ name, phone: phone || undefined, email: email || undefined, avatar: profileForm.avatar })
      await refreshSession()
      toast.success("Profile updated")
      setEditingProfile(false)
    } catch (err) {
      setProfileError(errMessage(err, "Couldn't save your profile. Please try again."))
    } finally {
      setSavingProfile(false)
    }
  }

  // ---------- password ----------
  const [pwForm, setPwForm] = useState<PasswordForm>({ current: "", next: "", confirm: "" })
  const [pwError, setPwError] = useState<string | null>(null)
  const [savingPw, setSavingPw] = useState(false)

  async function savePassword() {
    if (!pwForm.current) {
      setPwError("Enter your current password first.")
      return
    }
    if (pwForm.next.length < 6) {
      setPwError("New passwords must be at least 6 characters.")
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError("The new passwords don't match.")
      return
    }
    setSavingPw(true)
    setPwError(null)
    try {
      await authApi.updateProfile({ currentPassword: pwForm.current, password: pwForm.next })
      toast.success("Password changed")
      setPwForm({ current: "", next: "", confirm: "" })
    } catch (err) {
      setPwError(errMessage(err, "Couldn't change your password. Check your current password and try again."))
    } finally {
      setSavingPw(false)
    }
  }

  // ---------- addresses ----------
  const [addresses, setAddresses] = useState<AddressDTO[] | null>(null)
  const [addressesError, setAddressesError] = useState<string | null>(null)
  const [addressDialog, setAddressDialog] = useState<
    { mode: "add" } | { mode: "edit"; address: AddressDTO } | null
  >(null)
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS_FORM)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [deletingAddress, setDeletingAddress] = useState<AddressDTO | null>(null)
  const [removingAddress, setRemovingAddress] = useState(false)

  async function reloadAddresses() {
    try {
      const res = await addressesApi.list()
      setAddresses(res)
      setAddressesError(null)
    } catch (err) {
      setAddressesError(errMessage(err, "We couldn't load your saved addresses."))
    }
  }

  // ---------- notifications ----------
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)

  // ---------- back-in-stock watchlist ----------
  const [watchlist, setWatchlist] = useState<StockAlertDTO[] | null>(null)

  async function reloadWatchlist() {
    try {
      const res = await catalogApi.stockAlert.list()
      setWatchlist(res)
    } catch {
      setWatchlist([])
    }
  }

  // ---------- Sphere Points loyalty ----------
  const [loyalty, setLoyalty] = useState<LoyaltySummaryDTO | null>(null)

  async function reloadLoyalty() {
    try {
      setLoyalty(await ordersApi.loyalty())
    } catch {
      // fall back to the session balance so the card still shows something useful
      setLoyalty({
        balance: user?.loyaltyPoints ?? 0,
        lifetimeEarned: 0,
        pendingEarned: 0,
        redeemedTotal: 0,
        pointValue: LOYALTY.pointValue,
        minRedeem: LOYALTY.minRedeem,
        maxRedeemPct: LOYALTY.maxRedeemPct,
        history: [],
      })
    }
  }

  // ---------- notification channel preferences (API-backed) ----------
  const [prefs, setPrefs] = useState<NotificationPrefsDTO | null>(null)
  const [prefsSaving, setPrefsSaving] = useState(false)

  async function reloadPrefs() {
    try {
      setPrefs(await notificationsApi.prefs())
    } catch {
      setPrefs(null)
    }
  }

  async function toggleChannel(key: keyof NotificationPrefsDTO, label: string) {
    if (!prefs) return
    const prev = prefs
    const nextVal = !prefs[key]
    const next: NotificationPrefsDTO = { ...prefs, [key]: nextVal }
    setPrefs(next) // optimistic
    setPrefsSaving(true)
    try {
      if (key === "push" && nextVal) {
        const pushRes = await enablePushNotifications()
        if (!pushRes.success) {
          toast.error(pushRes.error || "Could not enable push notifications on this browser.")
          setPrefs(prev)
          setPrefsSaving(false)
          return
        }
      } else if (key === "push" && !nextVal) {
        await disablePushNotifications()
      }
      const saved = await notificationsApi.updatePrefs({ [key]: next[key] })
      setPrefs(saved)
      toast.success(`Preferences saved — ${label} ${saved[key] ? "on" : "off"}`)
    } catch (err) {
      setPrefs(prev) // revert on failure
      toast.error(errMessage(err, `Couldn't save your ${label} preference. Please try again.`))
    } finally {
      setPrefsSaving(false)
    }
  }
  const [markingRead, setMarkingRead] = useState(false)

  async function reloadNotifications() {
    try {
      const res = await notificationsApi.list()
      setNotifications(res)
      setNotificationsError(null)
    } catch (err) {
      setNotificationsError(errMessage(err, "We couldn't load your notifications."))
    }
  }

  // ---------- initial data load ----------
  useEffect(() => {
    if (authLoading || !isCustomer) return
    void Promise.all([reloadAddresses(), reloadNotifications(), reloadWatchlist(), reloadLoyalty(), reloadPrefs()])
  }, [authLoading, isCustomer])

  // ---------- account actions ----------
  const [signingOut, setSigningOut] = useState(false)

  async function signOut() {
    setSigningOut(true)
    try {
      await logout()
      toast.success("You've been signed out. See you soon!")
      navigate("home")
    } catch {
      toast.error("Couldn't sign out — please try again.")
    } finally {
      setSigningOut(false)
    }
  }

  // ---------- address dialog handlers ----------

  function openAddAddress() {
    setAddressForm(EMPTY_ADDRESS_FORM)
    setAddressError(null)
    setAddressDialog({ mode: "add" })
  }

  function openEditAddress(address: AddressDTO) {
    setAddressForm({
      label: address.label,
      text: address.text,
      area: address.area ?? "",
      notes: address.notes ?? "",
      isDefault: address.isDefault,
      latitude: address.latitude ?? null,
      longitude: address.longitude ?? null,
    })
    setAddressError(null)
    setAddressDialog({ mode: "edit", address })
  }

  async function saveAddress() {
    const dialog = addressDialog ?? { mode: "add" as const }
    const label = addressForm.label.trim()
    const text = addressForm.text.trim()
    if (!label) {
      setAddressError("Give this address a label, e.g. Home or Work.")
      return
    }
    if (text.length < 8) {
      setAddressError("Enter the full address — building, street and estate help our rider find you.")
      return
    }
    setSavingAddress(true)
    setAddressError(null)
    try {
      const payload = {
        label,
        text,
        area: addressForm.area.trim() || undefined,
        notes: addressForm.notes.trim() || undefined,
        isDefault: addressForm.isDefault || undefined,
        latitude: addressForm.latitude ?? undefined,
        longitude: addressForm.longitude ?? undefined,
      }
      if (dialog.mode === "add") {
        await addressesApi.create(payload)
        toast.success("Address saved")
      } else {
        await addressesApi.update(dialog.address.id, payload)
        toast.success("Address updated")
      }
      setAddressDialog(null)
      await reloadAddresses()
    } catch (err) {
      setAddressError(errMessage(err, "Couldn't save the address. Please try again."))
    } finally {
      setSavingAddress(false)
    }
  }

  async function removeAddress() {
    if (!deletingAddress) return
    setRemovingAddress(true)
    try {
      await addressesApi.remove(deletingAddress.id)
      toast.success("Address removed")
      setDeletingAddress(null)
      await reloadAddresses()
    } catch (err) {
      toast.error(errMessage(err, "Couldn't remove the address. Please try again."))
    } finally {
      setRemovingAddress(false)
    }
  }

  const unreadCount = (notifications ?? []).filter((n) => !n.read).length

  // ============================== GUARDS ==============================

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-32 w-full rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  // ---------- guest marketing ----------
  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card className="overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="gradient-hero flex flex-col justify-center gap-4 p-6 sm:p-8">
              <h1 className="text-2xl font-bold tracking-tight">Your Sphere Pharmacy account</h1>
              <p className="text-sm text-muted-foreground">
                One account for orders, prescriptions and deliveries — built for our Roysambu
                community.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => openAuth("login", "account")}>Sign in</Button>
                <Button variant="outline" onClick={() => openAuth("register", "account")}>
                  Create account
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Sign in with email &amp; password, or a quick phone OTP.
              </p>
            </div>
            <CardContent className="p-6 sm:p-8">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                What you get
              </h2>
              <ul className="space-y-4">
                {[
                  {
                    icon: PackageSearch,
                    title: "Live order tracking",
                    text: "Follow every order from review to pickup or doorstep delivery.",
                  },
                  {
                    icon: FileText,
                    title: "Prescription history & refills",
                    text: "Pharmacist responses, refill counts and repeat orders in one place.",
                  },
                  {
                    icon: MapPin,
                    title: "Saved addresses",
                    text: "Store home and work addresses for one-tap delivery checkout.",
                  },
                  {
                    icon: Zap,
                    title: "Faster checkout",
                    text: "Your details and payment preferences ready on every order.",
                  },
                ].map((b) => (
                  <li key={b.title} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <b.icon className="h-4.5 w-4.5 text-primary" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-medium">{b.title}</p>
                      <p className="text-sm text-muted-foreground">{b.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </div>
        </Card>
      </div>
    )
  }

  // ---------- staff ----------
  if (isStaff) {
    const staff = session.staff
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Avatar className="h-16 w-16">
              {staff?.avatar ? <AvatarImage src={staff.avatar} alt={staff.name} /> : null}
              <AvatarFallback className="text-lg font-semibold">
                {initials(staff?.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="flex flex-wrap items-center justify-center gap-2 text-lg font-bold">
                {staff?.name ?? "Staff account"}
                {staff ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    {ROLE_LABELS[staff.role]}
                  </Badge>
                ) : null}
              </h1>
              {staff?.title ? (
                <p className="mt-1 text-sm text-muted-foreground">{staff.title}</p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                {staff?.email ?? "—"}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => navigate("admin")}>
                <ShieldCheck className="h-4 w-4" aria-hidden />
                Open staff dashboard
              </Button>
              <Button variant="outline" onClick={() => void signOut()} disabled={signingOut}>
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden />
                )}
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================== CUSTOMER VIEW ==============================

  const areaOptions =
    addressForm.area && !ZONE_NAMES.includes(addressForm.area)
      ? [addressForm.area, ...ZONE_NAMES]
      : ZONE_NAMES

  return (
    <div className="app-page app-page-account mx-auto max-w-6xl px-4 py-8 pb-12">

      <MemberIntro kind="account" />

      <div className="grid gap-6 md:grid-cols-2">
        {/* ---------- profile ---------- */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" aria-hidden />
                Profile
              </span>
              {editingProfile ? null : (
                <Button variant="ghost" size="sm" onClick={startEditProfile}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {editingProfile ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar className="h-16 w-16">
                    {profileForm.avatar ? (
                      <AvatarImage src={profileForm.avatar} alt={profileForm.name || "Avatar"} />
                    ) : null}
                    <AvatarFallback className="text-base font-semibold">
                      {initials(profileForm.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                      {uploadingAvatar ? "Uploading your photo…" : "Upload profile photo"}
                    </Button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Choose a clear photo to personalise your account.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      autoComplete="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      disabled={savingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0712 345 678"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      disabled={savingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email">Email</Label>
                    <Input
                      id="profile-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      disabled={savingProfile}
                    />
                  </div>
                </div>
                {profileError ? (
                  <p className="text-sm text-destructive" role="alert">
                    {profileError}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => void saveProfile()} disabled={savingProfile}>
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <CheckCheck className="h-4 w-4" aria-hidden />
                    )}
                    Save changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingProfile(false)}
                    disabled={savingProfile}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-16 w-16">
                  {user?.avatar ? (
                    <AvatarImage src={user.avatar} alt={user.name ?? "Avatar"} />
                  ) : null}
                  <AvatarFallback className="text-lg font-semibold">
                    {initials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-semibold">{user?.name ?? "Customer"}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {user?.phone ?? "No phone on file"}
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    {user?.email ?? "No email on file"}
                  </p>
                  <p className="pt-1 text-xs text-muted-foreground">
                    Member since {formatDate(user?.createdAt ?? new Date().toISOString())}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---------- Sphere Points loyalty ---------- */}
        <Card className="overflow-hidden md:col-span-2">
          <CardContent className="p-0">
            <div className="grid md:grid-cols-[minmax(0,300px)_1fr]">
              {/* balance panel */}
              <div className="relative flex flex-col gap-3 bg-gradient-to-br from-teal-600 via-teal-600 to-emerald-700 p-6 text-white">
                <Sparkles className="absolute right-5 top-5 h-5 w-5 text-white/70" aria-hidden />
                <p className="text-xs font-bold uppercase tracking-widest text-white/80">
                  Sphere Points
                </p>
                {loyalty === null ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-32 bg-white/20" />
                    <Skeleton className="h-4 w-24 bg-white/20" />
                  </div>
                ) : (
                  <>
                    <p className="text-5xl font-black leading-none tabular-nums">
                      {loyalty.balance.toLocaleString()}
                      <span className="ml-1.5 text-lg font-bold text-white/70">pts</span>
                    </p>
                    <p className="text-sm font-medium text-white/85">
                      ≈ {formatKES(loyalty.balance * loyalty.pointValue)} value at checkout
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-sm">
                      <div>
                        <dt className="flex items-center gap-1 text-xs text-white/70">
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Earned
                        </dt>
                        <dd className="font-bold tabular-nums">{loyalty.lifetimeEarned.toLocaleString()} pts</dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-1 text-xs text-white/70">
                          <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> Redeemed
                        </dt>
                        <dd className="font-bold tabular-nums">{loyalty.redeemedTotal.toLocaleString()} pts</dd>
                      </div>
                    </dl>
                  </>
                )}
              </div>

              {/* rules + history */}
              <div className="space-y-4 p-5 sm:p-6">
                <div>
                  <h3 className="text-sm font-bold">How Sphere Points work</h3>
                  <ul className="mt-2 grid gap-1.5 text-sm text-muted-foreground sm:grid-cols-2">
                    <li className="flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      1 pt per KSh {LOYALTY.earnPerKES} spent
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      1 pt = KSh {LOYALTY.pointValue} at checkout
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      Redeem from {LOYALTY.minRedeem} pts
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      Max {LOYALTY.maxRedeemPct}% of an order
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold">
                    <History className="h-4 w-4 text-primary" aria-hidden />
                    Points history
                  </h3>
                  {loyalty === null ? (
                    <div className="mt-2 space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : loyalty.history.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                      Your points activity will appear here as you earn and redeem.
                    </p>
                  ) : (
                    <ul
                      className="scroll-slim mt-2 max-h-96 space-y-2 overflow-y-auto pr-1"
                      aria-label="Sphere Points history"
                    >
                      {loyalty.history.map((h) => (
                        <li key={h.orderId} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                          <span
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              h.pointsRedeemed > h.pointsEarned
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                            )}
                          >
                            {h.pointsRedeemed > h.pointsEarned ? (
                              <ArrowDownRight className="h-4 w-4" aria-hidden />
                            ) : (
                              <ArrowUpRight className="h-4 w-4" aria-hidden />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <button
                              className="truncate font-mono text-sm font-semibold hover:text-primary hover:underline"
                              onClick={() => navigate("order", { orderId: h.orderId })}
                              aria-label={`View order ${h.reference}`}
                            >
                              {h.reference}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(h.createdAt)} · {statusLabel(h.status)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {h.pointsEarned > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                +{h.pointsEarned} pts
                              </span>
                            ) : null}
                            {h.pointsRedeemed > 0 ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                −{h.pointsRedeemed} pts
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------- password ---------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden />
              Change password
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={pwForm.current}
                onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                disabled={savingPw}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-next">New password</Label>
              <Input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                disabled={savingPw}
                aria-describedby="pw-next-hint"
              />
              <p id="pw-next-hint" className="text-xs text-muted-foreground">
                At least 6 characters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                disabled={savingPw}
              />
            </div>
            {pwError ? (
              <p className="text-sm text-destructive" role="alert">
                {pwError}
              </p>
            ) : null}
            <Button onClick={() => void savePassword()} disabled={savingPw} className="w-full">
              {savingPw ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden />
              )}
              Update password
            </Button>
          </CardContent>
        </Card>

        {/* ---------- notification channels ---------- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
              Notification channels
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {prefs === null ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <>
                {(
                  [
                    { key: "email", label: "Email", icon: Mail, text: "Order confirmations and receipts via Resend" },
                  ] as const
                ).map((ch) => (
                  <div key={ch.key} className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <ch.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </span>
                      <div>
                        <Label htmlFor={`channel-${ch.key}`} className="text-sm font-medium">
                          {ch.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{ch.text}</p>
                      </div>
                    </div>
                    <Switch
                      id={`channel-${ch.key}`}
                      checked={prefs[ch.key]}
                      onCheckedChange={() => void toggleChannel(ch.key, ch.label)}
                      disabled={prefsSaving}
                      aria-label={`${ch.label} notifications`}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Bell className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <Label htmlFor="channel-inapp" className="text-sm font-medium">
                        In-app
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Order updates inside your account — always on
                      </p>
                    </div>
                  </div>
                  <Switch id="channel-inapp" checked disabled aria-label="In-app notifications (always on)" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email preferences apply to order, prescription and refill updates. In-app notifications are always on.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* ---------- addresses ---------- */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" aria-hidden />
                Saved addresses
              </span>
              <Button variant="outline" size="sm" onClick={openAddAddress}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add address
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {addressesError && addresses === null ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">{addressesError}</p>
                <Button variant="outline" size="sm" onClick={() => void reloadAddresses()}>
                  <Loader2 className="h-3.5 w-3.5" aria-hidden />
                  Try again
                </Button>
              </div>
            ) : addresses === null ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : addresses.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-10 text-center">
                <MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No saved addresses yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Save your home or work address for faster delivery checkout.
                </p>
                <Button size="sm" className="mt-4" onClick={openAddAddress}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add your first address
                </Button>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {addresses.map((address) => {
                  const LabelIcon = labelIcon(address.label)
                  return (
                    <li key={address.id}>
                      <div className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                            <LabelIcon className="h-3.5 w-3.5" aria-hidden />
                            {address.label}
                          </span>
                          {address.isDefault ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                              <Star className="h-3 w-3" aria-hidden />
                              Default
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm leading-snug">{address.text}</p>
                        {address.area ? (
                          <p className="mt-1 text-xs text-muted-foreground">{address.area}</p>
                        ) : null}
                        {address.notes ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">Notes:</span> {address.notes}
                          </p>
                        ) : null}
                        <div className="mt-3 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditAddress(address)}
                            aria-label={`Edit ${address.label} address`}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingAddress(address)}
                            aria-label={`Remove ${address.label} address`}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- back-in-stock watchlist ---------- */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BellRing className="h-4 w-4 text-primary" aria-hidden />
              Back-in-stock watchlist
              {(watchlist?.filter((w) => w.active).length ?? 0) > 0 ? (
                <Badge variant="secondary" className="font-semibold tabular-nums">
                  {watchlist!.filter((w) => w.active).length} active
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {watchlist === null ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : watchlist.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 py-8 text-center">
                <BellOff className="h-7 w-7 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">Nothing on your watchlist</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Out of stock? Open the product page and tap “Notify me when back in stock” and we&apos;ll message you here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {watchlist.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3"
                  >
                    <span className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      w.active ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    )}>
                      {w.active ? <Bell className="h-4 w-4" aria-hidden /> : <CheckCheck className="h-4 w-4" aria-hidden />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <button
                        className="truncate text-left text-sm font-semibold hover:text-primary hover:underline"
                        onClick={() => navigate("product", { productId: w.productId })}
                      >
                        {w.productName}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {w.active ? `Watching · added ${timeAgo(w.createdAt)}` : `Notified · ${timeAgo(w.createdAt)}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={async () => {
                        try {
                          await catalogApi.stockAlert.remove(w.id)
                          await reloadWatchlist()
                          toast.success("Removed from your watchlist")
                        } catch (err) {
                          toast.error(errMessage(err, "Couldn't remove the alert."))
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- notifications ---------- */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" aria-hidden />
                Notifications
                {unreadCount > 0 ? (
                  <Badge variant="secondary" className="font-semibold tabular-nums">
                    {unreadCount} new
                  </Badge>
                ) : null}
              </span>
              {unreadCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setMarkingRead(true)
                    try {
                      await notificationsApi.markAllRead()
                      await reloadNotifications()
                      toast.success("All notifications marked as read")
                    } catch (err) {
                      toast.error(errMessage(err, "Couldn't update notifications."))
                    } finally {
                      setMarkingRead(false)
                    }
                  }}
                  disabled={markingRead}
                >
                  {markingRead ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Mark all read
                </Button>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {notificationsError && notifications === null ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">{notificationsError}</p>
                <Button variant="outline" size="sm" onClick={() => void reloadNotifications()}>
                  <Loader2 className="h-3.5 w-3.5" aria-hidden />
                  Try again
                </Button>
              </div>
            ) : notifications === null ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 py-10 text-center">
                <BellOff className="h-8 w-8 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">You're all caught up</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Order updates, prescription reviews and refill reminders will appear here.
                </p>
              </div>
            ) : (
              <ul className="scroll-slim max-h-96 space-y-1 overflow-y-auto" aria-label="Notifications list">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
                      {n.read ? (
                        <span className="h-2 w-2 rounded-full bg-transparent" aria-hidden />
                      ) : (
                        <span
                          className="h-2 w-2 rounded-full bg-primary"
                          aria-label="Unread notification"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                    </div>
                    <p className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- security / account actions ---------- */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Security &amp; data
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => void signOut()}
              disabled={signingOut}
              className="sm:w-auto"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden />
              )}
              Sign out
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button variant="ghost" disabled className="w-full sm:w-auto">
                    <Download className="h-4 w-4" aria-hidden />
                    Download my data
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>
      </div>

      {/* ---------- address add/edit dialog ---------- */}
      <Dialog
        open={addressDialog != null}
        onOpenChange={(open) => {
          if (!open && !savingAddress) setAddressDialog(null)
        }}
      >
        <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden px-4 sm:max-w-lg sm:px-6">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {addressDialog?.mode === "edit" ? "Edit address" : "Add a new address"}
            </DialogTitle>
            <DialogDescription>
              Saved addresses speed up delivery checkout — pick one at step 2.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex min-h-0 flex-1 flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void saveAddress()
            }}
          >
            <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="addr-label">Label</Label>
                <Input
                  id="addr-label"
                  placeholder="e.g. Home, Work"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  disabled={savingAddress}
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor="addr-text">Full address</Label>
                  <UseCurrentLocationButton
                    disabled={savingAddress}
                    onResolved={(location) => {
                      const matched = areaOptions.find((zone) => {
                        const candidate = (location.area || "").toLowerCase()
                        return candidate && (candidate.includes(zone.toLowerCase()) || zone.toLowerCase().includes(candidate))
                      })
                      setAddressForm((current) => ({
                        ...current,
                        text: location.displayName,
                        area: matched || current.area,
                        latitude: location.latitude,
                        longitude: location.longitude,
                      }))
                    }}
                  />
                </div>
                <Textarea
                  id="addr-text"
                  rows={3}
                  placeholder="Building, street, estate / landmark — e.g. Amani Heights, Lumumba Drive, Roysambu"
                  value={addressForm.text}
                  onChange={(e) => setAddressForm({ ...addressForm, text: e.target.value })}
                  disabled={savingAddress}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-area">Delivery zone</Label>
                <Select
                  value={addressForm.area || undefined}
                  onValueChange={(v) => setAddressForm({ ...addressForm, area: v })}
                  disabled={savingAddress}
                >
                  <SelectTrigger id="addr-area" className="w-full">
                    <SelectValue placeholder="Choose your delivery zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {areaOptions.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addr-notes">Rider notes (optional)</Label>
                <Input
                  id="addr-notes"
                  placeholder="e.g. Gate 3, ask for the caretaker"
                  value={addressForm.notes}
                  onChange={(e) => setAddressForm({ ...addressForm, notes: e.target.value })}
                  disabled={savingAddress}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <Label htmlFor="addr-default" className="text-sm font-medium">
                    Default address
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Pre-selected automatically at checkout.
                  </p>
                </div>
                <Switch
                  id="addr-default"
                  checked={addressForm.isDefault}
                  onCheckedChange={(v) => setAddressForm({ ...addressForm, isDefault: v })}
                  disabled={savingAddress}
                  aria-label="Set as default address"
                />
              </div>
              {addressError ? (
                <p className="text-sm text-destructive" role="alert">
                  {addressError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddressDialog(null)}
                disabled={savingAddress}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingAddress} className="w-full sm:w-auto">
                {savingAddress ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CheckCheck className="h-4 w-4" aria-hidden />
                )}
                {addressDialog?.mode === "edit" ? "Save address" : "Add address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- delete address confirm ---------- */}
      <AlertDialog
        open={deletingAddress !== null}
        onOpenChange={(open) => {
          if (!open && !removingAddress) setDeletingAddress(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this address?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingAddress?.label}” — {deletingAddress?.text}. You can always add it again
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:justify-end">
            <AlertDialogCancel disabled={removingAddress}>Keep address</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void removeAddress()
              }}
              disabled={removingAddress}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removingAddress ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
