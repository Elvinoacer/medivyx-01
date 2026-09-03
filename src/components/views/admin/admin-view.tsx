"use client"

// Sphere Pharmacy — staff/admin dashboard shell.
// Role guard + sidebar navigation (desktop) / Sheet navigation (mobile) + section router.
// Section data refreshes via a refreshKey counter so actions in one section can
// trigger refetches in others (e.g. prescription review → orders + overview).

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { LogoFull } from "@/components/shared/logo"
import { ROLE_LABELS, PHARMACY, type Role } from "@/lib/constants"
import { initials, isOpenNow } from "@/lib/format"
import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  LayoutDashboard, Package, ClipboardList, Pill, Megaphone, Users, BarChart3,
  ShieldCheck, Settings, LogOut, Lock, Store, Menu, Loader2, RefreshCw, Bike, MessageSquareText,
  Bell, BellRing,
} from "lucide-react"
import { enablePushNotifications, getPushPermissionState } from "@/lib/firebase/client"
import type { LucideIcon } from "lucide-react"
import {
  type AdminSectionKey, type SectionProps,
} from "./admin-shared"
import { OverviewSection } from "./sections/overview-section"
import { OrdersSection } from "./sections/orders-section"
import { DispatchSection } from "./sections/dispatch-section"
import { PrescriptionsSection } from "./sections/prescriptions-section"
import { CatalogueSection } from "./sections/catalogue-section"
import { ReviewsSection } from "./sections/reviews-section"
import { PromotionsSection } from "./sections/promotions-section"
import { StaffSection } from "./sections/staff-section"
import { ReportsSection } from "./sections/reports-section"
import { ComplianceSection } from "./sections/compliance-section"
import { SettingsSection } from "./sections/settings-section"

const STAFF_ROLES: Role[] = ["ADMIN", "PHARMACIST", "STAFF", "RIDER"]
const ALL_STAFF: Role[] = ["ADMIN", "PHARMACIST", "STAFF", "RIDER"]

/** Narrow a session role down to a staff role (excludes CUSTOMER). */
function isStaffRole(role: Role | "CUSTOMER" | undefined): role is Role {
  return STAFF_ROLES.includes(role as Role)
}

interface NavItem {
  key: AdminSectionKey
  label: string
  title: string
  subtitle: string
  icon: LucideIcon
  roles: Role[]
}

const NAV: NavItem[] = [
  {
    key: "overview", label: "Overview", title: "Overview", subtitle: "Today at the pharmacy — orders, revenue and queue health",
    icon: LayoutDashboard, roles: ALL_STAFF,
  },
  {
    key: "orders", label: "Orders", title: "Orders", subtitle: "Process the order queue — confirm, review, take payment, dispatch",
    icon: Package, roles: ALL_STAFF,
  },
  {
    key: "dispatch", label: "Dispatch", title: "Dispatch board", subtitle: "Delivery orders — assign riders and track drop-offs to the door",
    icon: Bike, roles: ALL_STAFF,
  },
  {
    key: "prescriptions", label: "Prescriptions", title: "Prescription review", subtitle: "Verify uploaded prescriptions before dispensing",
    icon: ClipboardList, roles: ["ADMIN", "PHARMACIST"],
  },
  {
    key: "catalogue", label: "Catalogue", title: "Catalogue", subtitle: "Manage products, pricing, stock levels and CSV imports",
    icon: Pill, roles: ["ADMIN", "PHARMACIST", "STAFF"],
  },
  {
    key: "reviews", label: "Reviews", title: "Reviews", subtitle: "Moderate customer product reviews — publish or hide them",
    icon: MessageSquareText, roles: ["ADMIN", "PHARMACIST", "STAFF"],
  },
  {
    key: "promotions", label: "Promotions", title: "Promotions", subtitle: "Banners, promo codes and storefront campaigns",
    icon: Megaphone, roles: ["ADMIN", "STAFF"],
  },
  {
    key: "staff", label: "Staff", title: "Staff", subtitle: "Team members, roles and access",
    icon: Users, roles: ["ADMIN"],
  },
  {
    key: "reports", label: "Reports", title: "Reports", subtitle: "Sales, products and order funnel analytics with CSV export",
    icon: BarChart3, roles: ["ADMIN"],
  },
  {
    key: "compliance", label: "Compliance", title: "Compliance", subtitle: "PPB licence details and superintendent pharmacist record",
    icon: ShieldCheck, roles: ["ADMIN", "PHARMACIST"],
  },
  {
    key: "settings", label: "Settings", title: "Settings", subtitle: "Pharmacy profile, delivery fees and demo data",
    icon: Settings, roles: ["ADMIN"],
  },
]

function navItem(key: AdminSectionKey): NavItem | undefined {
  return NAV.find((n) => n.key === key)
}

const roleBadgeClass: Record<Role, string> = {
  ADMIN: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  PHARMACIST: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  STAFF: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  RIDER: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800",
}

export function AdminView() {
  const session = useAuthStore((s) => s.session)
  const authLoading = useAuthStore((s) => s.loading)
  const refreshSession = useAuthStore((s) => s.refresh)
  const logout = useAuthStore((s) => s.logout)
  const openAuth = useAppStore((s) => s.openAuth)
  const navigate = useAppStore((s) => s.navigate)

  const [section, setSection] = useState<AdminSectionKey>(() =>
    // riders land on their delivery board instead of the overview
    useAuthStore.getState().session?.role === "RIDER" ? "dispatch" : "overview"
  )
  const [refreshKey, setRefreshKey] = useState(0)
  const [navOpen, setNavOpen] = useState(false)
  const [autoLanded, setAutoLanded] = useState(false)

  const [pushStatus, setPushStatus] = useState<NotificationPermission>("default")
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    setPushStatus(getPushPermissionState())
  }, [])

  async function handleTogglePush() {
    setPushLoading(true)
    try {
      const res = await enablePushNotifications()
      if (res.success) {
        setPushStatus("granted")
        toast.success("Staff push alerts active! You will receive live alerts for new orders and prescriptions.")
      } else {
        toast.error(res.error || "Could not enable push alerts.")
      }
    } finally {
      setPushLoading(false)
    }
  }

  // Sonner toaster: mounted here so admin toasts render even though the root layout
  // only mounts the legacy use-toast Toaster (layout is outside this task's scope).
  const toaster = <Toaster closeButton position="bottom-right" richColors />

  // ---------- role guard ----------
  if (authLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <p className="text-sm font-medium">Loading staff dashboard…</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        {toaster}
      </div>
    )
  }

  const role = session?.role
  if (!session || !isStaffRole(role)) {
    return (
      <>
        <StaffGate
          isCustomer={role === "CUSTOMER"}
          onSignIn={() => openAuth("staff", "admin")}
          onBackToStore={() => navigate("home")}
          onSessionChange={refreshSession}
        />
        {toaster}
      </>
    )
  }

  const staff = session.staff
  const visibleNav = NAV.filter((n) => n.roles.includes(role))
  const active = navItem(section)
  const allowed = active ? active.roles.includes(role) : false
  const openNow = isOpenNow()

  const bumpRefresh = () => setRefreshKey((k) => k + 1)

  function goTo(next: AdminSectionKey) {
    const item = navItem(next)
    if (item && item.roles.includes(role as Role)) {
      setAutoLanded(true)
      setSection(next)
      setNavOpen(false)
    } else {
      toast.error("Your role doesn't have access to that section.")
    }
  }

  async function handleSignOut() {
    try {
      await logout()
      toast.success("Signed out of the staff dashboard.")
    } catch {
      toast.error("Sign out failed — please try again.")
    } finally {
      // reset the landing logic so the next sign-in auto-lands by role again
      setAutoLanded(false)
      setSection("overview")
    }
  }

  const sectionProps: SectionProps = {
    refreshKey,
    onRefresh: bumpRefresh,
    onNavigateSection: goTo,
  }

  function renderSection() {
    if (!allowed || !active) {
      return (
        <EmptyState
          icon={Lock}
          title="Restricted section"
          description={`The ${active?.label ?? "requested"} section isn't available to ${ROLE_LABELS[role as Role]} accounts. Ask an admin if you need access.`}
          action={{ label: "Back to Overview", onClick: () => setSection("overview") }}
        />
      )
    }
    switch (section) {
      case "overview":
        return <OverviewSection {...sectionProps} />
      case "orders":
        return <OrdersSection {...sectionProps} />
      case "dispatch":
        return <DispatchSection {...sectionProps} />
      case "prescriptions":
        return <PrescriptionsSection {...sectionProps} />
      case "catalogue":
        return <CatalogueSection {...sectionProps} />
      case "reviews":
        return <ReviewsSection {...sectionProps} />
      case "promotions":
        return <PromotionsSection {...sectionProps} />
      case "staff":
        return <StaffSection {...sectionProps} />
      case "reports":
        return <ReportsSection {...sectionProps} />
      case "compliance":
        return <ComplianceSection {...sectionProps} />
      case "settings":
        return <SettingsSection {...sectionProps} />
    }
  }

  return (
    <div className="w-full">
      {toaster}
      <div className="mx-auto flex w-full max-w-7xl items-stretch">
        {/* ---------- desktop sidebar ---------- */}
        <aside className="sticky top-32 hidden h-fit w-64 shrink-0 flex-col self-start border-r bg-muted/30 md:flex">
          <SidebarNav
            items={visibleNav}
            section={section}
            onSelect={goTo}
            staffName={staff?.name ?? "Staff"}
            staffRole={role as Role}
            onSignOut={handleSignOut}
          />
        </aside>

        {/* ---------- main column ---------- */}
        <div className="min-w-0 flex-1">
          {/* top bar */}
          <div className="flex min-h-14 flex-wrap items-center gap-2 border-b bg-background px-3 py-2 sm:px-5">
            {/* mobile hamburger */}
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Open admin menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b p-4">
                  <SheetTitle>
                    <LogoFull />
                  </SheetTitle>
                </SheetHeader>
                <div className="flex h-[calc(100%-4.5rem)] flex-col">
                  <SidebarNav
                    items={visibleNav}
                    section={section}
                    onSelect={goTo}
                    staffName={staff?.name ?? "Staff"}
                    staffRole={role as Role}
                    onSignOut={handleSignOut}
                    inSheet
                  />
                </div>
              </SheetContent>
            </Sheet>

            <h1 className="order-2 w-full text-base font-bold tracking-tight sm:order-1 sm:w-auto sm:text-lg">
              {active?.title ?? "Dashboard"}
            </h1>

            <div className="order-3 ml-auto flex flex-wrap items-center gap-1.5">
              <Button
                variant={pushStatus === "granted" ? "ghost" : "outline"}
                size="sm"
                onClick={handleTogglePush}
                disabled={pushLoading}
                className={cn(
                  "gap-1.5 text-xs font-medium",
                  pushStatus === "granted" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                )}
                title={pushStatus === "granted" ? "Push alerts active on this device" : "Enable push alerts for orders and prescriptions"}
              >
                {pushLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : pushStatus === "granted" ? (
                  <Bell className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <BellRing className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                )}
                <span className="hidden sm:inline">
                  {pushStatus === "granted" ? "Push alerts active" : "Enable push alerts"}
                </span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={bumpRefresh}
                aria-label="Refresh section data"
                title="Refresh section data"
                className="h-9 w-9"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              <span
                className={cn(
                  "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex",
                  openNow
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                )}
              >
                <span
                  className={cn("pulse-dot h-1.5 w-1.5 rounded-full", openNow ? "bg-emerald-500" : "bg-amber-500")}
                  aria-hidden
                />
                {openNow ? "Open now" : "Closed"} · {PHARMACY.hoursLabel.replace("Open daily · ", "")}
              </span>

              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("home")}>
                <Store className="h-4 w-4" />
                <span className="hidden sm:inline">Back to store</span>
                <span className="sm:hidden">Store</span>
              </Button>

              {staff ? (
                <span className="flex items-center gap-2">
                  <Avatar className="hidden h-8 w-8 sm:flex">
                    <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                      {initials(staff.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden text-right leading-tight sm:block">
                    <span className="block max-w-32 truncate text-xs font-semibold">{staff.name}</span>
                    <Badge variant="outline" className={cn("mt-0.5 px-1.5 py-0 text-[10px]", roleBadgeClass[role as Role])}>
                      {ROLE_LABELS[role as Role]}
                    </Badge>
                  </span>
                </span>
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-rose-600"
                onClick={handleSignOut}
                aria-label="Sign out of staff dashboard"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* section subtitle + content */}
          <div className="p-3 sm:p-5 lg:p-6">
            {active && allowed ? (
              <p className="mb-4 text-sm text-muted-foreground">{active.subtitle}</p>
            ) : null}
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- sidebar nav (shared by desktop aside & mobile sheet) ----------

function SidebarNav({
  items,
  section,
  onSelect,
  staffName,
  staffRole,
  onSignOut,
  inSheet = false,
}: {
  items: NavItem[]
  section: AdminSectionKey
  onSelect: (key: AdminSectionKey) => void
  staffName: string
  staffRole: Role
  onSignOut: () => void
  inSheet?: boolean
}) {
  return (
    <nav
      aria-label="Admin sections"
      className={cn("flex flex-1 flex-col gap-1 overflow-y-auto p-3 scroll-slim", !inSheet && "max-h-[calc(100vh-12rem)]")}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => onSelect(item.key)}
          aria-current={section === item.key ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
            section === item.key
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
          {item.label}
        </button>
      ))}

      <Separator className="my-3" />

      <div className="rounded-lg border bg-background p-3">
        <p className="text-xs font-semibold">{staffName}</p>
        <Badge variant="outline" className={cn("mt-1 px-1.5 py-0 text-[10px]", roleBadgeClass[staffRole])}>
          {ROLE_LABELS[staffRole]}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          className="mt-2.5 w-full gap-1.5"
          onClick={onSignOut}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </Button>
      </div>
    </nav>
  )
}

// ---------- gate for non-staff visitors ----------

function StaffGate({
  isCustomer,
  onSignIn,
  onBackToStore,
  onSessionChange,
}: {
  isCustomer: boolean
  onSignIn: () => void
  onBackToStore: () => void
  onSessionChange: () => Promise<void>
}) {
  // Light insurance poll: if the auth view signs a staff member in but doesn't sync the
  // auth store, pick the session up here so the dashboard appears.
  useEffect(() => {
    const t = setInterval(() => {
      void onSessionChange()
    }, 4000)
    return () => clearInterval(t)
  }, [onSessionChange])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-7 w-7" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Staff access only</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isCustomer
                ? "You're signed in with a customer account. The dashboard is for Sphere Pharmacy staff — admins, pharmacists, staff and riders."
                : "Sign in with your Sphere Pharmacy staff account to manage orders, prescriptions and the catalogue."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-2">
            <Button className="h-11 w-full" onClick={onSignIn}>
              Sign in as staff
            </Button>
            <Button variant="outline" className="h-11 w-full" onClick={onBackToStore}>
              <Store className="h-4 w-4" /> Back to storefront
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Demo staff logins: admin@ / pharmacist@ / staff@ / rider@spherepharmacy.co.ke
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
