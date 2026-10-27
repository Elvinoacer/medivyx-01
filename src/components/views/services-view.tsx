"use client"

import { MemberIntro } from "@/components/member/member-intro"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Check,
  Copy,
  X,
  Phone,
  MapPin,
  AlertCircle,
  Info,
  ExternalLink,
  CreditCard,
  Stethoscope,
  XCircle,
  Download,
  Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  ApiError,
  serviceBookingsApi,
  servicePaymentsApi,
  serviceReviewsApi,
  servicesApi,
} from "@/lib/api-client"
import { PHARMACY, waLink } from "@/lib/constants"
import type { ServiceBookingDTO, ServiceDTO, ServiceSlotDTO } from "@/lib/types"
import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ---------- Helper functions ----------

function copyToClipboard(text: string, label = "Reference") {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard!`, { description: text })
      })
      .catch(() => {
        toast.error("Could not copy to clipboard.")
      })
  }
}

function downloadIcsCalendar(booking: ServiceBookingDTO) {
  try {
    const start = new Date(booking.scheduledStart).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    const end = new Date(booking.scheduledEnd).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
    const title = `Sphere Pharmacy: ${booking.serviceName}`
    const description = `Appointment for ${booking.serviceName} at Sphere Pharmacy.\\nReference: ${booking.reference}\\nContact: ${PHARMACY.phone}`
    const location = PHARMACY.address

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Sphere Pharmacy//Care Bookings//EN",
      "BEGIN:VEVENT",
      `UID:${booking.id}@spherepharmacy.co.ke`,
      `DTSTAMP:${start}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${location}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `SpherePharmacy-${booking.reference}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Calendar invite downloaded!")
  } catch {
    toast.error("Could not generate calendar file.")
  }
}

function getBookingStatusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return {
        label: "Confirmed",
        color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
        icon: CheckCircle2,
        dot: "bg-emerald-500",
      }
    case "PENDING":
      return {
        label: "Pending confirmation",
        color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
        icon: Clock3,
        dot: "bg-amber-500",
      }
    case "IN_PROGRESS":
      return {
        label: "In consultation",
        color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        icon: Stethoscope,
        dot: "bg-blue-500",
      }
    case "ARRIVED":
      return {
        label: "Arrived at clinic",
        color: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
        icon: CheckCircle2,
        dot: "bg-indigo-500",
      }
    case "COMPLETED":
      return {
        label: "Completed",
        color: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
        icon: CheckCircle2,
        dot: "bg-teal-500",
      }
    case "CANCELLED":
      return {
        label: "Cancelled",
        color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
        icon: XCircle,
        dot: "bg-rose-500",
      }
    case "REJECTED":
      return {
        label: "Declined",
        color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
        icon: XCircle,
        dot: "bg-rose-500",
      }
    default:
      return {
        label: status.replaceAll("_", " "),
        color: "bg-muted text-muted-foreground border-border",
        icon: Clock3,
        dot: "bg-muted-foreground",
      }
  }
}

function getRelativeDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()

  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  if (isToday) return "Today"
  if (isTomorrow) return "Tomorrow"

  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`
  if (diffDays < 0) return "Past"
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" })
}

// ============================== MAIN VIEW ==============================

export function ServicesView() {
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const replace = useAppStore((s) => s.replace)
  const clearAuthIntent = useAppStore((s) => s.clearAuthIntent)
  const params = useAppStore((s) => s.params)
  const session = useAuthStore((s) => s.session)

  const [services, setServices] = useState<ServiceDTO[] | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL")
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  // Top-level tabs: "services" (catalog) vs "bookings" (dedicated place for appointments)
  const [activeTab, setActiveTab] = useState<"services" | "bookings">("services")
  const [bookingFilter, setBookingFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED">("ALL")

  // Dialog states
  const [bookingService, setBookingService] = useState<ServiceDTO | null>(null)
  const [detailService, setDetailService] = useState<ServiceDTO | null>(null)
  const [trackingBooking, setTrackingBooking] = useState<ServiceBookingDTO | null>(null)
  const [paymentBooking, setPaymentBooking] = useState<ServiceBookingDTO | null>(null)
  const [bookings, setBookings] = useState<ServiceBookingDTO[]>([])
  const [reviewBooking, setReviewBooking] = useState<ServiceBookingDTO | null>(null)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())

  // Initial load of services
  useEffect(() => {
    let cancelled = false
    servicesApi
      .list()
      .then((data) => {
        if (!cancelled) setServices(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "We could not load our services.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Load user bookings if authenticated
  useEffect(() => {
    if (!session?.user) {
      setBookings([])
      return
    }
    serviceBookingsApi
      .mine()
      .then((data) => {
        setBookings(data)
      })
      .catch(() => {})
  }, [session?.user?.id])

  // Support deep link to book or open bookings tab via params
  useEffect(() => {
    if (params.tab === "bookings") {
      setActiveTab("bookings")
    }

    // Homepage image cards open the corresponding service details for guests and members.
    // Booking deep links from sign-in keep their existing auto-book behavior.
    const previewServiceId = params.previewServiceId
    if (previewServiceId && services) {
      const preview = services.find((item) => item.id === previewServiceId)
      if (preview) {
        setDetailService(preview)
        replace("services", {})
      }
      return
    }

    const pendingServiceId = params.serviceId
    if (!session?.user || !pendingServiceId || !services) return
    const service = services.find((item) => item.id === pendingServiceId)
    if (!service) return
    setBookingService(service)
    clearAuthIntent()
    replace("services", {})
  }, [session?.user?.id, params.previewServiceId, params.serviceId, params.tab, services, clearAuthIntent, replace])

  // Extract distinct categories
  const categories = useMemo(() => {
    if (!services) return []
    const set = new Set<string>()
    services.forEach((s) => {
      if (s.category) set.add(s.category.trim())
    })
    return Array.from(set)
  }, [services])

  // Filtered services
  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (services ?? []).filter((s) => {
      const matchCat = selectedCategory === "ALL" || s.category?.toLowerCase() === selectedCategory.toLowerCase()
      const matchQuery =
        !q ||
        [s.name, s.category, s.shortDescription, s.description].some((v) =>
          v?.toLowerCase().includes(q)
        )
      return matchCat && matchQuery
    })
  }, [services, query, selectedCategory])

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (bookingFilter === "ACTIVE") {
        return ["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(b.status)
      }
      if (bookingFilter === "COMPLETED") {
        return b.status === "COMPLETED"
      }
      return true
    })
  }, [bookings, bookingFilter])

  const activeBookingsCount = useMemo(() => {
    return bookings.filter((b) => ["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(b.status)).length
  }, [bookings])

  // Handle booking creation with rich toast & auto-opening the status tracker!
  function handleBookingCreated(b: ServiceBookingDTO) {
    setBookings((prev) => [b, ...prev.filter((item) => item.id !== b.id)])
    setBookingService(null)

    const formattedTime = new Date(b.scheduledStart).toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Nairobi",
    })

    // Show high-visibility toast notification with clickable action to trace status immediately
    toast.success("Appointment booked successfully!", {
      description: `${b.serviceName} · Ref: #${b.reference} · ${formattedTime}`,
      duration: 10000,
      action: {
        label: "Track status & details",
        onClick: () => {
          setActiveTab("bookings")
          setTrackingBooking(b)
        },
      },
    })

    // Auto-open status tracker modal so customer gets instant reassurance and full visibility
    setTrackingBooking(b)
  }

  return (
    <div className="app-page app-page-services mx-auto max-w-7xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
      {/* ========================================================================= */}
      {/* 1. HERO BANNER WITH PHOTOREALISTIC BACKGROUND IMAGE & HIGH-CONTRAST OVERLAY */}
      {/* ========================================================================= */}
      {activeTab === "bookings" && session?.user ? <MemberIntro kind="appointments" /> : <section className="sphere-services-hero relative overflow-hidden rounded-3xl border shadow-xl min-h-[360px] md:min-h-[420px] flex items-center bg-teal-950">
        {/* Background Image Layer */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/services-banner.jpg"
            alt="Sphere Pharmacy Clinic & Care"
            className="h-full w-full object-cover object-right md:object-center select-none"
          />
          {/* Multi-layered gradient overlay ensuring text legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-teal-950 via-teal-950/90 to-teal-950/45 dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-950/50" />
          <div className="absolute inset-0 bg-gradient-to-t from-teal-950/80 via-transparent to-transparent md:hidden" />
          {/* Subtle ambient blur orb */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
        </div>

        {/* Content Layer */}
        <div className="relative z-10 max-w-2xl px-6 py-10 sm:px-10 sm:py-14 text-white">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[.16em] backdrop-blur shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-emerald-300" /> Sphere Clinical Care
          </span>

          <h1 className="mt-4 text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
            A little time for you.<br />
            <em>Care beyond the counter.</em>
          </h1>

          <p className="mt-3.5 max-w-xl text-sm sm:text-base leading-relaxed text-white/80">
            Professional diagnostic testing, preventative wellness checks, and confidential private consultations conducted by certified community pharmacists on Lumumba Drive.
          </p>

          {/* Trust Highlights */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-emerald-200/90 font-medium">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Certified Pharmacists
            </span>
            <span className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-emerald-400" /> Same-Day & Advance Booking
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Private Consultation Area
            </span>
          </div>

          {/* Active Bookings Notice in Banner (if customer has booked appointments) */}
          {bookings.length > 0 ? (
            <div className="mt-6 inline-flex flex-wrap items-center gap-2.5 rounded-2xl border border-emerald-400/30 bg-emerald-950/60 p-2.5 sm:px-4 sm:py-2 text-xs text-white backdrop-blur">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>
                You have <strong>{bookings.length}</strong> scheduled appointment{bookings.length > 1 ? "s" : ""}.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("bookings")}
                className="font-bold underline text-emerald-300 hover:text-white transition-colors ml-auto sm:ml-2"
              >
                View & track status →
              </button>
            </div>
          ) : null}

          {/* Call to Actions */}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              onClick={() => setActiveTab("services")}
              className="rounded-full bg-white px-5 text-teal-950 font-semibold hover:bg-white/90 shadow-md"
            >
              Browse care services <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-white/30 bg-black/20 px-5 text-white hover:bg-white/10 backdrop-blur"
            >
              <a
                href={waLink("Hello Sphere Pharmacy! I would like to ask about your clinic and care services.")}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle className="h-4 w-4 mr-1.5" /> Talk to our team
              </a>
            </Button>
          </div>
        </div>
      </section>}

      {/* ========================================================================= */}
      {/* 2. DEDICATED SEPARATED TABS (SERVICES CATALOG vs. MY BOOKINGS HUB) */}
      {/* ========================================================================= */}
      <div className="mt-8 border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Segmented Navigation */}
        <div className="inline-flex rounded-xl bg-muted/60 p-1 border shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all",
              activeTab === "services"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Stethoscope className="h-4 w-4 text-primary" />
            Explore Services
            {services ? (
              <span className="ml-1 text-xs text-muted-foreground font-normal">({services.length})</span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!session?.user) {
                openAuth("login", "services", "Sign in to view your booked appointments.", { tab: "bookings" })
                return
              }
              setActiveTab("bookings")
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all relative",
              activeTab === "bookings"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CalendarDays className="h-4 w-4 text-primary" />
            My Bookings
            {bookings.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-[11px] font-bold">
                {bookings.length}
              </span>
            ) : null}
            {activeBookingsCount > 0 && activeTab !== "bookings" ? (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            ) : null}
          </button>
        </div>

        {/* Quick Helper Links */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>{PHARMACY.address}</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB A: EXPLORE SERVICES (PREMIUM CATALOG) */}
      {/* ========================================================================= */}
      {activeTab === "services" && (
        <div className="mt-6 space-y-6">
          {/* Filter Bar & Search */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                  selectedCategory === "ALL"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                All Services
              </button>

              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tests, consults, checks..."
                className="pl-9 pr-8 text-xs sm:text-sm h-9"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Services Cards Grid */}
          {services === null && !error ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <Card className="border-destructive/40">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-2" />
                {error}
              </CardContent>
            </Card>
          ) : filteredServices.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-sm text-muted-foreground">
                <Stethoscope className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="font-semibold text-foreground text-base">No services match your search.</p>
                <p className="mt-1 text-xs">Try selecting a different category or clearing your search term.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("")
                    setSelectedCategory("ALL")
                  }}
                  className="mt-4 rounded-full"
                >
                  Reset filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((service) => (
                <Card
                  key={service.id}
                  className="group overflow-hidden rounded-2xl border border-border/80 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 bg-card"
                >
                  <div>
                    {/* Hero image / category badge / duration pill */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                      {service.heroImage ? (
                        <img
                          src={service.heroImage}
                          alt={service.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-muted/40">
                          <Stethoscope className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}

                      {/* Category Badge */}
                      <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                        {service.category || "Pharmacy care"}
                      </div>

                      {/* Duration Pill */}
                      <div className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur flex items-center gap-1">
                        <Clock3 className="h-3 w-3" />
                        {service.durationMinutes} min
                      </div>
                    </div>

                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold leading-snug group-hover:text-primary transition-colors">
                          {service.name}
                        </h3>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                        {service.shortDescription || service.description || "Certified care service available from Sphere Pharmacy."}
                      </p>

                      {/* Clinical trust checklist */}
                      <div className="mt-4 pt-3 border-t space-y-1.5 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Private consultation room</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>Immediate clinical evaluation</span>
                        </div>
                      </div>
                    </CardContent>
                  </div>

                  {/* Card Footer: Price & Booking Actions */}
                  <div className="p-5 pt-0">
                    <div className="flex items-center justify-between gap-2 pt-3 border-t">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Consultation fee
                        </span>
                        <span className="text-sm font-extrabold text-foreground">
                          {service.priceLabel || (service.price != null && service.price > 0 ? `KSh ${service.price.toLocaleString()}` : "Free / Inquire")}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailService(service)}
                          className="h-8 text-xs rounded-full"
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 gap-1.5 rounded-full text-xs font-semibold shadow-xs"
                          onClick={() => {
                            if (!session?.user) {
                              openAuth(
                                "login",
                                "services",
                                "Sign in to book this service. You will return directly to complete your booking.",
                                { serviceId: service.id }
                              )
                              return
                            }
                            setBookingService(service)
                          }}
                        >
                          <CalendarDays className="h-3.5 w-3.5" /> Book
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Need help choosing a service? */}
          <div className="mt-10 rounded-2xl border bg-muted/20 p-5 sm:p-7 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-bold text-foreground">Not sure which service you need?</p>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Our resident pharmacists can guide you on the best tests or consultations for your symptoms.
                </p>
              </div>
              <Button asChild className="rounded-full shrink-0">
                <a
                  href={waLink("Hello Sphere Pharmacy! I would like guidance on choosing the right care service.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" /> Ask a Pharmacist
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB B: MY BOOKINGS HUB (SEPARATE PLACE, NEVER CRAMMED AT BOTTOM!) */}
      {/* ========================================================================= */}
      {activeTab === "bookings" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Appointments Hub</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Your booked care appointments</h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Track status in real-time, view clinic instructions, or manage your appointment details.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setBookingFilter("ALL")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  bookingFilter === "ALL" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                All ({bookings.length})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter("ACTIVE")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  bookingFilter === "ACTIVE" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                Active ({activeBookingsCount})
              </button>
              <button
                type="button"
                onClick={() => setBookingFilter("COMPLETED")}
                className={cn(
                  "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                  bookingFilter === "COMPLETED" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
                )}
              >
                Completed
              </button>
            </div>
          </div>

          {!session?.user ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-lg font-bold">Sign in to view your appointments</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Sign in with your phone or email to track your service bookings and medical consultations.
                </p>
                <Button
                  onClick={() => openAuth("login", "services", "Sign in to view your appointments.", { tab: "bookings" })}
                  className="mt-4 rounded-full"
                >
                  Sign In
                </Button>
              </CardContent>
            </Card>
          ) : filteredBookings.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="text-lg font-bold">No appointments found</h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  {bookingFilter === "ALL"
                    ? "You haven't scheduled any pharmacy care appointments yet."
                    : "No appointments match this filter."}
                </p>
                <Button onClick={() => setActiveTab("services")} className="mt-4 rounded-full">
                  Browse available services →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredBookings.map((booking) => {
                const statusInfo = getBookingStatusBadge(booking.status)
                const StatusIcon = statusInfo.icon
                const relativeLabel = getRelativeDateLabel(booking.scheduledStart)
                const scheduledDate = new Date(booking.scheduledStart).toLocaleDateString("en-KE", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "Africa/Nairobi",
                })
                const scheduledTime = new Date(booking.scheduledStart).toLocaleTimeString("en-KE", {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "Africa/Nairobi",
                })

                return (
                  <Card
                    key={booking.id}
                    className="overflow-hidden border border-border/80 shadow-xs hover:shadow-md transition-all bg-card flex flex-col justify-between"
                  >
                    <CardContent className="p-5 space-y-3.5">
                      {/* Top Header: Service Title & Status Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base text-foreground leading-tight">
                            {booking.serviceName}
                          </h3>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{booking.reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(booking.reference, "Booking reference")}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy reference"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <Badge variant="outline" className={cn("gap-1 text-xs px-2.5 py-0.5 font-medium shrink-0", statusInfo.color)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusInfo.dot)} />
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {/* Date, Time & Relative Badge */}
                      <div className="rounded-xl bg-muted/40 p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-4 w-4 text-primary shrink-0" />
                          <div className="truncate">
                            <p className="font-semibold text-foreground">{scheduledDate}</p>
                            <p className="text-muted-foreground text-[11px] flex items-center gap-1 mt-0.5">
                              <Clock3 className="h-3 w-3" /> at {scheduledTime} (EAT)
                            </p>
                          </div>
                        </div>

                        <span className="rounded-full bg-primary/10 text-primary font-bold px-2.5 py-0.5 text-[11px] shrink-0">
                          {relativeLabel}
                        </span>
                      </div>

                      {/* Payment & Location Summary */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t">
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Fee:</span>
                          <span className="font-bold text-foreground">
                            {booking.price && booking.price > 0 ? `KSh ${booking.price.toLocaleString()}` : "Free"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({booking.paymentStatus === "PAID"
                              ? "✓ Paid"
                              : booking.paymentStatus === "PAY_AT_PHARMACY"
                                ? "Pay at counter"
                                : "Unpaid"})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span>Lumumba Drive Clinic</span>
                        </div>
                      </div>

                      {booking.customerNotes ? (
                        <p className="rounded-lg bg-muted/30 p-2 text-xs italic text-muted-foreground line-clamp-2">
                          “{booking.customerNotes}”
                        </p>
                      ) : null}
                    </CardContent>

                    {/* Actions Footer */}
                    <div className="bg-muted/20 px-5 py-3 border-t flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Status Tracer & Full Details Button */}
                        <Button
                          size="sm"
                          onClick={() => setTrackingBooking(booking)}
                          className="h-8 text-xs gap-1.5 rounded-full font-semibold"
                        >
                          <StatusIcon className="h-3.5 w-3.5" /> Trace status & details →
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {booking.price &&
                        booking.price > 0 &&
                        booking.paymentStatus !== "PAID" &&
                        !["CANCELLED", "REJECTED"].includes(booking.status) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-full"
                            onClick={() => setPaymentBooking(booking)}
                          >
                            <CreditCard className="h-3.5 w-3.5 mr-1" /> Pay
                          </Button>
                        ) : null}

                        {booking.status === "COMPLETED" && !reviewedIds.has(booking.id) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs rounded-full"
                            onClick={() => setReviewBooking(booking)}
                          >
                            <Star className="h-3.5 w-3.5 mr-1 text-amber-500" /> Review
                          </Button>
                        ) : null}

                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                          title="Ask question on WhatsApp"
                        >
                          <a
                            href={waLink(
                              `Hello Sphere Pharmacy! I have a question regarding my appointment #${booking.reference} (${booking.serviceName}).`
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BOOKING STATUS TRACER & DETAILS MODAL (FULL STATUS & CONCERN TRACER) */}
      {/* ========================================================================= */}
      {trackingBooking ? (
        <BookingTraceDialog
          booking={trackingBooking}
          onClose={() => setTrackingBooking(null)}
          onPay={() => {
            setPaymentBooking(trackingBooking)
          }}
          onReview={() => {
            setReviewBooking(trackingBooking)
          }}
        />
      ) : null}

      {/* ========================================================================= */}
      {/* 4. SERVICE PREVIEW / DETAIL MODAL */}
      {/* ========================================================================= */}
      {detailService ? (
        <ServiceDetailDialog
          service={detailService}
          onClose={() => setDetailService(null)}
          onBook={() => {
            const svc = detailService
            setDetailService(null)
            if (!session?.user) {
              openAuth(
                "login",
                "services",
                "Sign in to book this service. You will return directly to complete your booking.",
                { serviceId: svc.id }
              )
              return
            }
            setBookingService(svc)
          }}
        />
      ) : null}

      {/* ========================================================================= */}
      {/* 5. APPOINTMENT BOOKING FORM DIALOG */}
      {/* ========================================================================= */}
      {bookingService ? (
        <BookingDialog
          service={bookingService}
          onClose={() => setBookingService(null)}
          onCreated={handleBookingCreated}
        />
      ) : null}

      {/* ========================================================================= */}
      {/* 6. SERVICE PAYMENT DIALOG */}
      {/* ========================================================================= */}
      {paymentBooking ? (
        <ServicePaymentDialog
          booking={paymentBooking}
          onClose={() => setPaymentBooking(null)}
          onPaid={() => {
            setBookings((prev) =>
              prev.map((b) => (b.id === paymentBooking.id ? { ...b, paymentStatus: "PAID" } : b))
            )
            if (trackingBooking?.id === paymentBooking.id) {
              setTrackingBooking((prev) => (prev ? { ...prev, paymentStatus: "PAID" } : null))
            }
            setPaymentBooking(null)
          }}
        />
      ) : null}

      {/* ========================================================================= */}
      {/* 7. SERVICE REVIEW DIALOG */}
      {/* ========================================================================= */}
      {reviewBooking ? (
        <ServiceReviewDialog
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmitted={() => {
            setReviewedIds((prev) => new Set(prev).add(reviewBooking.id))
            setReviewBooking(null)
          }}
        />
      ) : null}
    </div>
  )
}

// =========================================================================
// BOOKING STATUS TRACER DIALOG COMPONENT
// =========================================================================

function BookingTraceDialog({
  booking,
  onClose,
  onPay,
  onReview,
}: {
  booking: ServiceBookingDTO
  onClose: () => void
  onPay: () => void
  onReview: () => void
}) {
  const statusInfo = getBookingStatusBadge(booking.status)
  const isCancelled = ["CANCELLED", "REJECTED"].includes(booking.status)

  // Status milestones
  const steps = [
    {
      id: "SUBMITTED",
      title: "Request Submitted",
      desc: "Appointment slot reserved by patient",
      isDone: true,
      isActive: false,
    },
    {
      id: "CONFIRMED",
      title: "Confirmed by Pharmacy",
      desc: "Clinical schedule verified and reserved",
      isDone: ["CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED"].includes(booking.status),
      isActive: booking.status === "PENDING",
    },
    {
      id: "IN_PROGRESS",
      title: "In Consultation",
      desc: "Session with pharmacist/clinician",
      isDone: ["IN_PROGRESS", "COMPLETED"].includes(booking.status),
      isActive: ["CONFIRMED", "ARRIVED"].includes(booking.status),
    },
    {
      id: "COMPLETED",
      title: "Visit Completed",
      desc: "Care service delivered successfully",
      isDone: booking.status === "COMPLETED",
      isActive: booking.status === "IN_PROGRESS",
    },
  ]

  const scheduledDate = new Date(booking.scheduledStart).toLocaleDateString("en-KE", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  })
  const scheduledTime = new Date(booking.scheduledStart).toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  })
  const scheduledEndTime = new Date(booking.scheduledEnd).toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[92dvh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="border-b p-5 shrink-0 bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  #{booking.reference}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(booking.reference, "Booking reference")}
                  className="text-muted-foreground hover:text-foreground text-xs inline-flex items-center gap-1 font-medium"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
              <DialogTitle className="text-xl font-bold mt-1 text-foreground">
                {booking.serviceName}
              </DialogTitle>
            </div>

            <Badge variant="outline" className={cn("text-xs px-3 py-1 font-semibold gap-1.5", statusInfo.color)}>
              <span className={cn("h-2 w-2 rounded-full", statusInfo.dot)} />
              {statusInfo.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Status Alert Banner */}
          {isCancelled ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
              <div className="flex items-start gap-2.5">
                <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">This appointment was cancelled or declined.</p>
                  <p className="mt-1">
                    If you have questions or wish to book a different time slot, please chat with our pharmacy team on WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          ) : booking.status === "CONFIRMED" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs sm:text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Your appointment is confirmed!</p>
                  <p className="mt-1">
                    Please arrive at Sphere Pharmacy on Lumumba Drive 5 minutes prior to your scheduled time. Our pharmacist has been reserved for your visit.
                  </p>
                </div>
              </div>
            </div>
          ) : booking.status === "PENDING" ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs sm:text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <div className="flex items-start gap-2.5">
                <Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Awaiting pharmacy schedule verification</p>
                  <p className="mt-1">
                    We have received your booking request. Our team will verify slot availability and send an automated confirmation message.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Visual Progress Stepper (Timeline) */}
          <div className="rounded-2xl border bg-muted/20 p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Booking Progress
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-2 relative">
              {steps.map((step, index) => {
                return (
                  <div key={step.id} className="flex sm:flex-col items-start gap-3 sm:gap-2">
                    {/* Step Icon */}
                    <div
                      className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border transition-all",
                        step.isDone
                          ? "bg-primary text-primary-foreground border-primary"
                          : step.isActive
                            ? "border-primary text-primary bg-primary/10 ring-2 ring-primary/20 animate-pulse"
                            : "border-muted-foreground/30 text-muted-foreground bg-muted"
                      )}
                    >
                      {step.isDone ? <Check className="h-4 w-4" /> : index + 1}
                    </div>

                    <div>
                      <p
                        className={cn(
                          "text-xs font-semibold leading-tight",
                          step.isDone || step.isActive ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Appointment Information Grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* When & Where */}
            <div className="rounded-2xl border p-4 space-y-3 bg-card">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                When & Where
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">{scheduledDate}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {scheduledTime} – {scheduledEndTime} (East Africa Time)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t">
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-foreground">{PHARMACY.name}</p>
                    <p className="text-muted-foreground text-[11px]">{PHARMACY.address}</p>
                    <a
                      href={PHARMACY.mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                    >
                      Open in Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Preparation & Notes */}
            <div className="rounded-2xl border p-4 space-y-3 bg-card">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Preparation Guidelines
              </p>

              <ul className="text-xs space-y-1.5 text-muted-foreground">
                <li className="flex items-start gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Please carry a valid National ID or Passport.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Bring any current medication packaging or prescriptions.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Please arrive 5 minutes early for registration.</span>
                </li>
              </ul>

              {booking.customerNotes ? (
                <div className="pt-2 border-t text-xs">
                  <span className="font-semibold text-foreground">Your Notes:</span>
                  <p className="text-muted-foreground italic mt-0.5">“{booking.customerNotes}”</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Payment Status & Option */}
          <div className="rounded-2xl border p-4 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div>
              <span className="text-[11px] uppercase font-bold text-muted-foreground block">
                Payment Status
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-extrabold text-sm text-foreground">
                  {booking.price && booking.price > 0 ? `KSh ${booking.price.toLocaleString()}` : "Free Consultation"}
                </span>
                <span className="text-muted-foreground font-medium">
                  {booking.paymentStatus === "PAID"
                    ? "✓ Paid in full"
                    : booking.paymentStatus === "PAY_AT_PHARMACY"
                      ? "Pay at pharmacy counter"
                      : "Unpaid"}
                </span>
              </div>
            </div>

            {booking.price && booking.price > 0 && booking.paymentStatus !== "PAID" && !isCancelled ? (
              <Button size="sm" onClick={onPay} className="rounded-full gap-1.5">
                <CreditCard className="h-3.5 w-3.5" /> Pay Now via M-Pesa
              </Button>
            ) : null}
          </div>

          {/* ========================================================================= */}
          {/* "ANYTHING IN CONCERN" / ASSISTANCE & QUICK ACTIONS */}
          {/* ========================================================================= */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Need Help or Have Concerns?
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Have questions before your visit, need to report symptoms, or want to reschedule?
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild size="sm" className="rounded-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <a
                  href={waLink(
                    `Hello Sphere Pharmacy! I have a question concerning my appointment #${booking.reference} (${booking.serviceName}) scheduled for ${scheduledDate}.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Chat on WhatsApp
                </a>
              </Button>

              <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5">
                <a href={`tel:${PHARMACY.phone}`}>
                  <Phone className="h-3.5 w-3.5 text-primary" /> Call Clinic ({PHARMACY.phoneDisplay})
                </a>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadIcsCalendar(booking)}
                className="rounded-full gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> Add to Calendar
              </Button>

              {booking.status === "COMPLETED" ? (
                <Button variant="outline" size="sm" onClick={onReview} className="rounded-full gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-500" /> Review Experience
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t p-4 bg-background shrink-0">
          <Button variant="outline" onClick={onClose} className="rounded-full text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =========================================================================
// SERVICE PREVIEW / DETAIL MODAL
// =========================================================================

function ServiceDetailDialog({
  service,
  onClose,
  onBook,
}: {
  service: ServiceDTO
  onClose: () => void
  onBook: () => void
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg max-h-[92dvh] overflow-y-auto p-0 gap-0">
        {service.heroImage ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
            <img src={service.heroImage} alt={service.name} className="h-full w-full object-cover" />
            <div className="absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
              {service.category || "Care service"}
            </div>
          </div>
        ) : null}

        <DialogHeader className="p-5 border-b">
          <DialogTitle className="text-xl font-bold">{service.name}</DialogTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1 font-medium">
              <Clock3 className="h-3.5 w-3.5 text-primary" /> {service.durationMinutes} minutes
            </span>
            <span>·</span>
            <span className="font-bold text-foreground">
              {service.priceLabel || (service.price != null && service.price > 0 ? `KSh ${service.price.toLocaleString()}` : "Free / Inquire")}
            </span>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 text-xs sm:text-sm text-muted-foreground">
          <p className="leading-relaxed">
            {service.description || service.shortDescription || "Care service provided by the certified clinical team at Sphere Pharmacy."}
          </p>

          <div className="rounded-xl bg-muted/40 p-3.5 space-y-2 text-xs">
            <p className="font-bold text-foreground">What to expect:</p>
            <ul className="space-y-1.5 list-disc list-inside">
              <li>Confidential, dedicated in-person consultation space.</li>
              <li>Detailed discussion of symptoms, results, or medication regimens.</li>
              <li>Guidance on next steps and clinical documentation.</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="border-t p-4 flex flex-row items-center justify-between gap-2 bg-background">
          <Button variant="outline" onClick={onClose} className="rounded-full text-xs">
            Cancel
          </Button>
          <Button onClick={onBook} className="rounded-full text-xs gap-1.5 font-semibold">
            <CalendarDays className="h-3.5 w-3.5" /> Book appointment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =========================================================================
// BOOKING APPOINTMENT FORM DIALOG
// =========================================================================

function BookingDialog({
  service,
  onClose,
  onCreated,
}: {
  service: ServiceDTO
  onClose: () => void
  onCreated: (booking: ServiceBookingDTO) => void
}) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [slots, setSlots] = useState<ServiceSlotDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ServiceSlotDTO | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const openAuth = useAppStore((s) => s.openAuth)

  useEffect(() => {
    setSelected(null)
    setLoading(true)
    serviceBookingsApi
      .slots(service.id, date)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoading(false))
  }, [service.id, date])

  async function submit() {
    if (!selected) return
    setSaving(true)
    setMessage(null)
    try {
      const b = await serviceBookingsApi.create({
        serviceId: service.id,
        start: selected.start,
        end: selected.end,
        customerNotes: notes,
      })
      onCreated(b)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        openAuth("login", "services", "Sign in to book a service.")
        return
      }
      setMessage(err instanceof Error ? err.message : "Could not create booking.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg max-h-[92dvh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="p-5 border-b">
          <DialogTitle className="text-lg font-bold">Book {service.name}</DialogTitle>
          <DialogDescription className="text-xs">
            Choose your preferred date and time slot. Your appointment will be held pending pharmacy confirmation.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground">Select appointment date</label>
            <Input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 text-xs sm:text-sm"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-foreground">Available time slots</p>
            {loading ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" /> Checking availability for this date…
              </div>
            ) : slots.length === 0 ? (
              <div className="mt-2 rounded-xl border border-dashed p-5 text-center text-xs text-muted-foreground">
                No slots are available on this date. Please select another day.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 max-h-48 overflow-y-auto pr-1">
                {slots.map((slot) => (
                  <Button
                    key={slot.start}
                    type="button"
                    variant={selected?.start === slot.start ? "default" : "outline"}
                    onClick={() => setSelected(slot)}
                    className="text-xs h-8"
                  >
                    {slot.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              Notes or symptoms <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific symptoms or health context for our pharmacist?"
              className="mt-1.5 text-xs resize-none"
            />
          </div>

          {message ? <p className="text-xs text-destructive font-medium">{message}</p> : null}

          {/* Duration & Selected Slot summary */}
          <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5 text-primary" /> Expected duration: {service.durationMinutes} minutes
            </div>
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {selected ? `Selected: ${selected.label}` : "Select an available slot above"}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t p-4 flex flex-row items-center justify-between gap-2 bg-background">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full text-xs">
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={!selected || saving}
            className="rounded-full text-xs font-semibold gap-1.5"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}
            {saving ? "Confirming booking…" : "Confirm appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =========================================================================
// SERVICE PAYMENT DIALOG
// =========================================================================

function ServicePaymentDialog({
  booking,
  onClose,
  onPaid,
}: {
  booking: ServiceBookingDTO
  onClose: () => void
  onPaid: () => void
}) {
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)

  async function payMpesa() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await servicePaymentsApi.mpesa(booking.id, phone)
      setMessage(res.message + " Check your phone for the M-Pesa STK PIN prompt.")
      const poll = window.setInterval(async () => {
        try {
          const status = await servicePaymentsApi.status(booking.id)
          if (status.paymentStatus === "SUCCESS") {
            window.clearInterval(poll)
            setPaid(true)
            setBusy(false)
            onPaid()
          }
        } catch {}
      }, 3000)
      window.setTimeout(() => {
        window.clearInterval(poll)
        setBusy(false)
      }, 120000)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start M-Pesa payment.")
      setBusy(false)
    }
  }

  async function payCard() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await servicePaymentsApi.card(booking.id)
      window.location.href = res.checkoutUrl
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not initiate card payment.")
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md max-h-[92dvh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Pay for {booking.serviceName}</DialogTitle>
          <DialogDescription className="text-xs">
            Appointment #{booking.reference} · Total: KSh {(booking.price || 0).toLocaleString()}
          </DialogDescription>
        </DialogHeader>

        {paid ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <p className="mt-2 font-bold text-base">Payment received!</p>
            <p className="mt-1 text-xs">
              Your appointment is confirmed under reference <strong>{booking.reference}</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Flexible Payment Options</p>
              <p className="mt-0.5">You can pay securely right now via M-Pesa or card, or opt to pay at the pharmacy counter during your visit.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">M-Pesa phone number</label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                className="mt-1.5 text-xs sm:text-sm"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                onClick={() => void payMpesa()}
                disabled={busy || !phone}
                className="text-xs rounded-full"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Pay with M-Pesa
              </Button>
              <Button
                variant="outline"
                onClick={() => void payCard()}
                disabled={busy}
                className="text-xs rounded-full"
              >
                Pay with Card
              </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                setBusy(true)
                try {
                  await servicePaymentsApi.payAtPharmacy(booking.id)
                  toast.success("Preference saved: Pay at pharmacy counter.")
                  onClose()
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : "Could not save payment preference.")
                } finally {
                  setBusy(false)
                }
              }}
            >
              Pay at pharmacy counter during visit
            </Button>

            {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={busy} className="rounded-full text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =========================================================================
// SERVICE REVIEW DIALOG
// =========================================================================

function ServiceReviewDialog({
  booking,
  onClose,
  onSubmitted,
}: {
  booking: ServiceBookingDTO
  onClose: () => void
  onSubmitted: () => void
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!rating) {
      setError("Please choose a star rating.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await serviceReviewsApi.create(booking.id, rating, comment.trim() || undefined)
      toast.success("Thank you for reviewing your visit!")
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your review.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md max-h-[92dvh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Review {booking.serviceName}</DialogTitle>
          <DialogDescription className="text-xs">
            How was your consultation and care experience at Sphere Pharmacy?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} stars`}
                className="rounded-full p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "h-8 w-8",
                    value <= rating ? "fill-amber-400 text-amber-500" : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>

          <Textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share feedback on the pharmacist's advice, wait time, or clinic environment..."
            className="text-xs resize-none"
          />

          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy} className="rounded-full text-xs">
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !rating} className="rounded-full text-xs gap-1.5">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
            {busy ? "Submitting…" : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
