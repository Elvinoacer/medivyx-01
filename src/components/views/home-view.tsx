"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Toaster } from "@/components/ui/sonner"
import { ProductCard } from "@/components/shared/product-card"
import { ProductImage } from "@/components/shared/product-image"
import { SectionHeader, LoadingGrid } from "@/components/shared/empty-state"
import { LuxuryCategoriesShowcase } from "@/components/home/luxury-categories-showcase"
import { PriorityProductsSection } from "@/components/home/priority-products-section"
import { LogoMark } from "@/components/shared/logo"
import { useAppStore } from "@/store/use-app-store"
import { useRecentStore } from "@/store/use-wish-store"
import { catalogApi, promotionsApi } from "@/lib/api-client"
import type { CategoryDTO, ProductDTO, ProductsResponse, PromotionDTO } from "@/lib/types"
import { PHARMACY, waLink, DELIVERY_DEFAULTS } from "@/lib/constants"
import { formatKES, isOpenNow } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Search, Upload, ShieldCheck, Wallet, MapPin, Phone, MessageCircle, Clock,
  ShieldAlert, ArrowRight, Truck, Sparkles, RefreshCw, Bot, Copy, History,
} from "lucide-react"

// ---------- tiny async hook (exhaustive-deps handled per call) ----------

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function load() {
      setState((s) => ({ data: s.data, loading: true, error: null }))
      try {
        const data = await fn()
        if (!cancelled) setState({ data, loading: false, error: null })
      } catch (err) {
        if (!cancelled)
          setState({ data: null, loading: false, error: err instanceof Error ? err.message : "Failed to load" })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [...deps, nonce])
  return { ...state, reload: () => setNonce((n) => n + 1) }
}

// ---------- promotion color accents ----------

const promoThemes: Record<string, string> = {
  teal: "from-teal-600 via-emerald-600 to-teal-700",
  emerald: "from-emerald-600 via-teal-600 to-emerald-700",
  amber: "from-amber-500 via-orange-500 to-amber-600",
  rose: "from-rose-500 via-pink-500 to-rose-600",
  orange: "from-orange-500 via-amber-500 to-orange-600",
  stone: "from-stone-600 via-stone-500 to-stone-700",
  neutral: "from-stone-600 via-neutral-600 to-stone-700",
}

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: "Browse & add to cart",
    text: "Search medicines, vitamins and devices, or shop by category. Prices in KSh, stock shown live.",
  },
  {
    icon: Upload,
    title: "Upload your prescription",
    text: "Cart includes ℞ items? Upload a photo or PDF at checkout — it takes seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Pharmacist confirms",
    text: "Our pharmacist verifies every prescription and confirms availability before dispensing.",
  },
  {
    icon: Wallet,
    title: "Pay your way",
    text: "M-Pesa STK push, card, or cash on pickup/delivery. You can even reserve and pay in store.",
  },
  {
    icon: MapPin,
    title: "Pickup or delivery",
    text: "Collect from Lumumba Drive in ~2 hours with a pickup code, or get it delivered to your door.",
  },
]

const zoneFee = (needle: string): number =>
  DELIVERY_DEFAULTS.zones.find((z) => z.name.trim().toLowerCase() === needle)?.fee ?? DELIVERY_DEFAULTS.flatFee

const TRUST_ITEMS = [
  { icon: ShieldCheck, title: "Pharmacist-reviewed", text: "Every prescription checked before dispensing" },
  { icon: Wallet, title: "Flexible payments", text: "M-Pesa, card & cash accepted" },
  {
    icon: Truck,
    title: "Local delivery",
    text: `Roysambu from ${formatKES(DELIVERY_DEFAULTS.zones[0].fee)} · free over ${formatKES(DELIVERY_DEFAULTS.freeOver ?? 3000)}`,
  },
  { icon: MessageCircle, title: "WhatsApp ordering", text: "Chat with us and order in minutes" },
]

const FAQS = [
  {
    q: "How do I place an order?",
    a: "Browse the catalogue, add items to your cart, then checkout. Choose pickup at our Lumumba Drive shop or delivery within Nairobi. For prescription items you will upload your prescription during checkout — a pharmacist reviews it before we dispense.",
  },
  {
    q: "How do prescription (℞) items work?",
    a: "Add the medicines you need, then upload a photo or PDF of your prescription at checkout. Our pharmacist verifies it (usually within 30 minutes during opening hours). If anything needs clarification we call or WhatsApp you before dispensing. You need an account to order prescription items.",
  },
  {
    q: "Where do you deliver, and what does it cost?",
    a: `We deliver across Nairobi with zone-based fees: Roysambu/TRM from ${formatKES(zoneFee("roysambu / trm area"))}, Kasarani ${formatKES(zoneFee("kasarani"))}, Githurai 44 ${formatKES(zoneFee("githurai 44"))}, Ruaraka/Baba Dogo ${formatKES(zoneFee("ruaraka / baba dogo"))}, Nairobi CBD ${formatKES(zoneFee("nairobi cbd"))} and other Nairobi areas from ${formatKES(zoneFee("other nairobi areas"))}. Orders above ${formatKES(DELIVERY_DEFAULTS.freeOver ?? 3000)} are delivered free.`,
  },
  {
    q: "What payment methods can I use?",
    a: "M-Pesa (STK push to your phone — just enter your PIN), debit/credit card, cash on pickup or delivery, or reserve now and pay in store. Prescription items are dispensed only after pharmacist review, whatever payment method you choose.",
  },
  {
    q: "How can I track my order?",
    a: "Every order gets a reference like SPH-1234. Open “My orders” to follow live status — from received, prescription review, payment and preparation, to ready-for-pickup or out-for-delivery. Pickup orders also get a pickup code to quote at the counter.",
  },
  {
    q: "Can I order via WhatsApp or phone?",
    a: `Yes — message us on WhatsApp (${PHARMACY.phoneDisplay}) with a photo of your prescription or a list of what you need, or call us directly. We arrange payment and pickup/delivery the same way as online orders.`,
  },
]

// ============================== VIEW ==============================

export function HomeView() {
  const navigate = useAppStore((s) => s.navigate)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const resetCatalogFilters = useAppStore((s) => s.resetCatalogFilters)
  const setAssistantOpen = useAppStore((s) => s.setAssistantOpen)
  const recentIdList = useRecentStore((s) => s.ids)
  const recentIds = useMemo(() => recentIdList.map((i) => i.productId), [recentIdList])

  const [query, setQuery] = useState("")
  const open = isOpenNow()

  const categories = useAsync<CategoryDTO[]>(() => catalogApi.categories(), [])
  const promotions = useAsync<PromotionDTO[]>(() => promotionsApi.list(), [])
  const popular = useAsync<ProductsResponse>(() => catalogApi.products({ sort: "popular", pageSize: 10 }), [])
  const recent = useAsync<ProductDTO[]>(
    () =>
      recentIds.length === 0
        ? Promise.resolve([])
        : Promise.all(
            recentIds
              .slice(0, 6)
              .map((id) => catalogApi.product(id).catch(() => null))
          ).then((list) => list.filter((p): p is ProductDTO => p !== null)),
    [recentIds.join(",")]
  )

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setCatalogFilters({ search: q })
    navigate("catalog")
  }

  function shopCategory(c: CategoryDTO) {
    setCatalogFilters({ category: c.id, search: "" })
    navigate("catalog")
  }

  function browseAll() {
    resetCatalogFilters()
    navigate("catalog")
  }

  return (
    <div className="pb-10">
      <Toaster position="bottom-left" richColors closeButton />

      {/* ============ HERO ============ */}
      <section className="gradient-hero relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-10 sm:pb-16 sm:pt-14 lg:pb-20 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
            {/* ---- left: copy ---- */}
            <div className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left">
              {/* open / closed pill */}
              <div className="mb-5 flex justify-center lg:justify-start">
                <span
                  className={cn(
                    "animate-rise inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm",
                    open
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                  )}
                >
                  <span className={cn("pulse-dot inline-block h-2 w-2 rounded-full", open ? "bg-emerald-500 text-emerald-500" : "bg-amber-500 text-amber-500")} aria-hidden />
                  {open ? "Open now" : "Closed right now"} · {PHARMACY.hoursLabel}
                </span>
              </div>

              <p className="animate-rise eyebrow mb-3 justify-center lg:justify-start">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> Community pharmacy · Lumumba Drive, Roysambu
              </p>
              <h1 className="animate-rise [animation-delay:60ms] text-balance text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl sm:leading-[1.05] lg:text-6xl lg:leading-[1.02]">
                Your pharmacy,{" "}
                <span className="bg-gradient-to-r from-teal-700 to-emerald-600 bg-clip-text text-transparent dark:from-teal-400 dark:to-emerald-400">
                  now online.
                </span>
              </h1>
              <p className="animate-rise [animation-delay:120ms] mx-auto mt-5 text-balance text-base text-foreground/75 sm:text-lg lg:mx-0">
                {PHARMACY.tagline}. Order medicines, vitamins and health devices for
                pickup on Lumumba Drive or same-day delivery — prescriptions reviewed
                by our pharmacist.
              </p>

              {/* search */}
              <form onSubmit={submitSearch} className="animate-rise [animation-delay:180ms] mx-auto mt-7 flex max-w-xl items-center gap-2 lg:mx-0" role="search">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Panadol, amoxicillin, vitamins…"
                    className="h-12 rounded-full border-2 bg-background pl-10 pr-4 text-base shadow-sm"
                    aria-label="Search products"
                    enterKeyHint="search"
                  />
                </div>
                <Button type="submit" size="lg" className="btn-sheen h-12 rounded-full px-5 sm:px-7" disabled={!query.trim()}>
                  Search
                </Button>
              </form>

              {/* CTAs */}
              <div className="animate-rise [animation-delay:240ms] mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Button size="lg" className="btn-sheen h-12 gap-2 rounded-full px-6 text-base" onClick={browseAll}>
                  Browse products <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 gap-2 rounded-full px-6 text-base" onClick={() => navigate("prescriptions")}>
                  <Upload className="h-4 w-4" /> Upload prescription
                </Button>
              </div>

              <div className="animate-rise [animation-delay:300ms] mt-4 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <a
                  href={waLink("Hello Sphere Pharmacy! I'd like to place an order.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button variant="secondary" size="sm" className="gap-1.5 rounded-full bg-emerald-700 text-white hover:bg-emerald-800">
                    <MessageCircle className="h-4 w-4" /> Order via WhatsApp
                  </Button>
                </a>
                <a href={`tel:${PHARMACY.phone}`} className="inline-flex">
                  <Button variant="ghost" size="sm" className="gap-1.5 rounded-full">
                    <Phone className="h-4 w-4" /> {PHARMACY.phoneDisplay}
                  </Button>
                </a>
              </div>

              {/* trust chips */}
              <ul className="animate-rise [animation-delay:360ms] mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground lg:justify-start">
                <li className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden /> Pickup ready in ~2 hours
                </li>
                <li className="flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" aria-hidden /> M-Pesa · card · cash
                </li>
                <li className="flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" aria-hidden /> WhatsApp ordering
                </li>
              </ul>
            </div>

            {/* ---- right: photo ---- */}
            <div className="animate-rise relative [animation-delay:200ms]">
              {/* decorative tinted panel behind the frame */}
              <div
                aria-hidden
                className="absolute -inset-2 -rotate-1 rounded-3xl bg-gradient-to-br from-teal-500/15 via-emerald-400/10 to-teal-600/10 dark:from-teal-400/10 dark:via-emerald-400/5 dark:to-teal-500/10"
              />
              <figure className="img-frame relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3]">
                <img
                  src="/images/hero-pharmacy.png"
                  alt="Inside Sphere Pharmacy — a bright, modern dispensing counter with neatly stocked shelves in teal tones"
                  width={1344}
                  height={768}
                  className="h-full w-full object-cover dark:brightness-[0.92]"
                  fetchPriority="high"
                />
                {/* teal gradient overlay, stronger at the bottom */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-teal-950/55 via-teal-900/10 to-transparent dark:from-teal-950/70 dark:via-teal-950/20"
                />

                {/* floating glass stat card — pharmacist review */}
                <div className="absolute left-4 top-5 hidden select-none items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-3 pr-4 shadow-lifted backdrop-blur-md sm:flex dark:border-white/10 dark:bg-stone-900/70">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="block leading-tight">
                    <span className="block text-sm font-bold">Pharmacist-reviewed ℞</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Every prescription verified</span>
                  </span>
                </div>

                {/* floating glass stat card — delivery */}
                <div className="absolute bottom-5 right-4 hidden select-none items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-3 pr-4 shadow-lifted backdrop-blur-md sm:flex dark:border-white/10 dark:bg-stone-900/70">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600/15 text-teal-700 dark:text-teal-400">
                    <Truck className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="block leading-tight">
                    <span className="block text-sm font-bold">Same-day delivery</span>
                    <span className="tnum mt-0.5 block text-xs text-muted-foreground">
                      Roysambu from {formatKES(DELIVERY_DEFAULTS.zones[0].fee)}
                    </span>
                  </span>
                </div>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ============ CATEGORIES ============ */}
      <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="categories-heading">
        <SectionHeader
          title="Departments & Care Aisles"
          subtitle="Curated collections from certified pharmaceuticals to daily nutritional vitality"
          action={
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={browseAll}>
              View all aisles <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />
        <h2 id="categories-heading" className="sr-only">
          Product categories
        </h2>

        <LuxuryCategoriesShowcase
          categories={categories.data}
          loading={categories.loading}
          error={categories.error}
          onRetry={categories.reload}
        />
      </section>

      {/* ============ PROMOTIONS ============ */}
      {(promotions.loading || (promotions.data && promotions.data.length > 0)) && (
        <section className="mx-auto max-w-7xl px-4 py-6" aria-labelledby="promotions-heading">
          <SectionHeader
            title="Offers & promotions"
            subtitle="Seasonal deals and health campaigns running right now"
          />
          <h2 id="promotions-heading" className="sr-only">
            Current promotions
          </h2>

          {promotions.loading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full min-w-[280px] max-w-sm rounded-2xl sm:min-w-[320px]" />
              ))}
            </div>
          ) : (
            <div className="scroll-slim flex snap-x gap-4 overflow-x-auto pb-2">
              {promotions.data?.map((p) => (
                <article
                  key={p.id}
                  className={cn(
                    "relative w-full min-w-[280px] max-w-sm flex-1 snap-start overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-md sm:min-w-[320px]",
                    promoThemes[p.color ?? "teal"] ?? promoThemes.teal
                  )}
                >
                  <Sparkles className="absolute -right-4 -top-4 h-20 w-20 text-white/15" aria-hidden />
                  {p.badge ? (
                    <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide backdrop-blur">
                      {p.badge}
                    </span>
                  ) : null}
                  <h3 className="mt-2.5 text-lg font-bold leading-snug">{p.title}</h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-white/90">{p.description}</p>
                  <div className="mt-3.5 flex items-center gap-2">
                    {p.discountPct ? (
                      <span className="rounded-md bg-white px-2 py-0.5 text-xs font-extrabold text-emerald-700">
                        {p.discountPct}% OFF
                      </span>
                    ) : null}
                    {p.code ? (
                      <button
                        className="flex items-center gap-1.5 rounded-md border border-dashed border-white/60 px-2 py-0.5 text-xs font-semibold tracking-wider transition-colors hover:bg-white/15"
                        onClick={() => {
                          void navigator.clipboard?.writeText(p.code!).then(
                            () => toast.success(`Code ${p.code} copied — apply it at checkout`),
                            () => toast(`Code: ${p.code}`)
                          )
                        }}
                        aria-label={`Copy promo code ${p.code}`}
                      >
                        <Copy className="h-3 w-3" aria-hidden /> {p.code}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ============ CURATED PRIORITY PRODUCTS ============ */}
      <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="popular-heading">
        <SectionHeader
          title="Priority & Popular Care"
          subtitle="Most trusted treatments, community staples, and pharmacist-verified formulations"
          action={
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={browseAll}>
              Full pharmacy catalog <ArrowRight className="h-4 w-4" />
            </Button>
          }
        />
        <h2 id="popular-heading" className="sr-only">
          Popular products
        </h2>

        <PriorityProductsSection
          data={popular.data}
          loading={popular.loading}
          error={popular.error}
          onRetry={popular.reload}
        />
      </section>

      {/* ============ RECENTLY VIEWED ============ */}
      {recent.data && recent.data.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-8" aria-labelledby="recent-heading">
          <SectionHeader
            title="Pick up where you left off"
            subtitle="Products you recently looked at"
            action={
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => useRecentStore.getState().clear()}>
                <History className="h-4 w-4" /> Clear
              </Button>
            }
          />
          <h2 id="recent-heading" className="sr-only">
            Recently viewed products
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recent.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ============ HOW ORDERING WORKS ============ */}
      <section className="border-y bg-muted/30" aria-labelledby="how-heading">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <SectionHeader title="How ordering works" subtitle="From search to doorstep in five simple steps" />
          <h2 id="how-heading" className="sr-only">
            How ordering works
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title}>
                <Card className="card-lift h-full">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <step.icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="text-2xl font-black text-muted-foreground/25">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold">{step.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ DELIVERY BANNER ============ */}
      <section className="mx-auto max-w-7xl px-4 pt-10" aria-label="Delivery across Nairobi">
        <div className="img-frame group relative h-40 select-none sm:h-48">
          <img
            src="/images/delivery-rider.png"
            alt="Sphere Pharmacy courier on a motorbike with a medical delivery box"
            width={1344}
            height={768}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] dark:brightness-[0.9]"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-teal-950/90 via-teal-950/50 to-transparent sm:via-teal-950/25 dark:from-teal-950/90 dark:via-teal-950/45"
          />
          <div className="absolute inset-0 flex max-w-[72%] flex-col justify-center gap-1 p-5 text-white sm:p-7">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-teal-200 dark:text-teal-300">
              <Truck className="h-3.5 w-3.5" aria-hidden /> Same-day delivery
            </span>
            <p className="text-lg font-extrabold leading-tight sm:text-2xl">Across Nairobi — from <span className="tnum">{formatKES(DELIVERY_DEFAULTS.zones[0].fee)}</span></p>
            <p className="text-xs text-white/90 sm:text-sm">Zone fees to your door · free over {formatKES(DELIVERY_DEFAULTS.freeOver ?? 3000)}</p>
          </div>
        </div>
      </section>

      {/* ============ TRUST STRIP ============ */}
      <section className="mx-auto max-w-7xl px-4 py-10" aria-label="Why shop with us">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((t) => (
            <div key={t.title} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
                <t.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ PHARMACY INFO + MAP ============ */}
      <section className="mx-auto max-w-7xl px-4 py-6" aria-labelledby="visit-heading">
        <SectionHeader title="Visit or reach us" subtitle={PHARMACY.legalName} />
        <h2 id="visit-heading" className="sr-only">
          Pharmacy location and contact
        </h2>
        <div className="grid gap-4 lg:grid-cols-5">
          {/* pharmacist photo */}
          <figure className="img-frame group relative aspect-[4/3] self-start lg:col-span-2">
            <img
              src="/images/pharmacist-consult.png"
              alt="A friendly Sphere Pharmacy pharmacist handing medicine to a customer over the counter"
              width={1152}
              height={864}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 dark:brightness-[0.95]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-teal-950/80 via-teal-950/20 to-transparent dark:from-teal-950/85 dark:via-teal-950/25"
            />
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4 text-white">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
              <span className="text-sm font-semibold leading-tight">Our pharmacist confirms every prescription</span>
            </figcaption>
          </figure>

          {/* contact card */}
          <Card className="lg:col-span-3">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <LogoMark className="text-primary" />
                <div>
                  <p className="text-base font-bold">{PHARMACY.name}</p>
                  <p className="text-xs text-muted-foreground">{PHARMACY.tagline}</p>
                </div>
              </div>
              <Separator />
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>{PHARMACY.address}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    {PHARMACY.hoursLabel}
                    <span className="ml-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      <span className={cn("pulse-dot inline-block h-1.5 w-1.5 rounded-full", open ? "bg-emerald-500 text-emerald-500" : "bg-amber-500 text-amber-500")} />
                      {open ? "Open" : "Closed"}
                    </span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <a href={`tel:${PHARMACY.phone}`} className="hover:text-primary hover:underline">
                    {PHARMACY.phoneDisplay}
                  </a>
                </li>
                <li className="flex items-start gap-3">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <a
                    href={waLink("Hello Sphere Pharmacy!")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    WhatsApp us on {PHARMACY.phoneDisplay}
                  </a>
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`tel:${PHARMACY.phone}`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Phone className="h-4 w-4" /> Call
                  </Button>
                </a>
                <a href={waLink("Hello Sphere Pharmacy! I'd like to make an enquiry.")} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* map placeholder */}
          <Card className="overflow-hidden lg:col-span-5">
            <CardContent className="p-0">
              <div className="relative flex h-full min-h-[260px] flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-emerald-50 to-teal-100 p-6 text-center dark:from-teal-950/50 dark:via-emerald-950/40 dark:to-teal-900/40">
                {/* faux map grid */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.15]" aria-hidden>
                  <div className="absolute left-1/2 top-0 h-full w-px bg-teal-700" />
                  <div className="absolute left-0 top-[55%] h-px w-full -rotate-6 bg-teal-700" />
                  <div className="absolute left-[25%] top-0 h-full w-0.5 rotate-12 bg-teal-700/60" />
                  <div className="absolute left-0 top-[30%] h-px w-full rotate-3 bg-teal-700/60" />
                  <div className="absolute right-[15%] top-0 h-full w-px rotate-6 bg-teal-700/40" />
                </div>
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-primary/20">
                  <MapPin className="h-8 w-8" aria-hidden />
                </span>
                <p className="relative mt-4 max-w-xs text-sm font-semibold">Lumumba Drive · Roysambu</p>
                <p className="relative mt-1 max-w-xs text-xs text-muted-foreground">{PHARMACY.address}</p>
                <a href={PHARMACY.mapsUrl} target="_blank" rel="noopener noreferrer" className="relative mt-4">
                  <Button size="sm" className="gap-1.5">
                    <MapPin className="h-4 w-4" /> Open in Google Maps
                  </Button>
                </a>
                <p className="relative mt-3 text-[11px] text-muted-foreground">Ready in ~2 hours for pickup orders</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* compliance note — NO licence claim */}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 px-3.5 py-2.5 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          Licence details pending confirmation — our PPB premise licence information will be published here once
          confirmed by the proprietor.
        </p>
      </section>

      {/* ============ FAQ ============ */}
      <section className="mx-auto max-w-3xl px-4 py-10" aria-labelledby="faq-heading">
        <SectionHeader title="Frequently asked questions" subtitle="Everything you need to know about ordering" />
        <h2 id="faq-heading" className="sr-only">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
          {FAQS.map((f, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border-b last:border-b-0">
              <AccordionTrigger className="text-left text-sm font-semibold hover:text-primary hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border bg-muted/30 p-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-semibold">Still have a question?</p>
              <p className="text-xs text-muted-foreground">Ask our AI assistant — it answers medication and ordering questions instantly.</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setAssistantOpen(true)}>
            <MessageCircle className="h-4 w-4" /> Ask our assistant
          </Button>
        </div>
      </section>

    </div>
  )
}
