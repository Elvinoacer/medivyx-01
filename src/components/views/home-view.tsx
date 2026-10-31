"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ProductCard } from "@/components/shared/product-card"
import { ProductImage } from "@/components/shared/product-image"
import { SectionHeader, LoadingGrid } from "@/components/shared/empty-state"
import { LuxuryCategoriesShowcase } from "@/components/home/luxury-categories-showcase"
import { PriorityProductsSection } from "@/components/home/priority-products-section"
import { LogoMark } from "@/components/shared/logo"
import { useAppStore } from "@/store/use-app-store"
import { useRecentStore } from "@/store/use-wish-store"
import { catalogApi } from "@/lib/api-client"
import type { CategoryDTO, ProductDTO, ProductsResponse } from "@/lib/types"
import { PHARMACY, waLink, DELIVERY_DEFAULTS } from "@/lib/constants"
import { formatKES, isOpenNow } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  Search, Upload, ShieldCheck, Wallet, MapPin, Phone, MessageCircle, Clock,
  ShieldAlert, ArrowRight, Truck, RefreshCw, Bot, History,
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
  const open = isOpenNow()

  const categories = useAsync<CategoryDTO[]>(() => catalogApi.categories(), [])
  const popular = useAsync<ProductsResponse>(() => catalogApi.products({ sort: "popular", pageSize: 10 }), [])
  const recent = useAsync<ProductDTO[]>(
    () =>
      recentIds.length === 0
        ? Promise.resolve([])
        : catalogApi.products({ ids: recentIds.slice(0, 6).join(","), sort: "newest", pageSize: 6 }).then((result) => {
            const byId = new Map(result.items.map((product) => [product.id, product]))
            return recentIds.map((id) => byId.get(id)).filter((product): product is ProductDTO => Boolean(product)).slice(0, 6)
          }),
    [recentIds.join(",")]
  )

  function shopCategory(c: CategoryDTO) {
    setCatalogFilters({ category: c.id, search: "" })
    navigate("catalog")
  }

  function browseAll() {
    resetCatalogFilters()
    navigate("catalog")
  }

  return (
    <div className="landing-page pb-10">

      {/* ============ CATEGORIES ============ */}
      <section className="landing-section mx-auto max-w-7xl px-4 py-12" aria-labelledby="categories-heading">
        <SectionHeader
          title="Shop by need"
          subtitle="Everyday care, thoughtfully organised for quicker decisions"
          action={
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={browseAll}>
              Explore all categories <ArrowRight className="h-4 w-4" />
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

      {/* ============ CURATED PRIORITY PRODUCTS ============ */}
      <section className="landing-section mx-auto max-w-7xl px-4 py-12" aria-labelledby="popular-heading">
        <SectionHeader
          title="Community essentials"
          subtitle="Popular medicines, wellness products, and trusted everyday staples"
          action={
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={browseAll}>
              Browse the full pharmacy <ArrowRight className="h-4 w-4" />
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
        <section className="landing-section mx-auto max-w-7xl px-4 py-8" aria-labelledby="recent-heading">
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
      <section className="landing-process border-y bg-muted/30" aria-labelledby="how-heading">
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
      <section className="landing-delivery mx-auto max-w-7xl px-4 pt-10" aria-label="Delivery across Nairobi">
        <div className="img-frame group relative h-40 select-none sm:h-48">
          <Image
            src="/images/sphere_pharmacy_banner_url.webp"
            alt="Medivyx brand banner"
            width={1344}
            height={768}
            sizes="(max-width: 1280px) calc(100vw - 32px), 1280px"
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
      <section className="landing-trust mx-auto max-w-7xl px-4 py-10" aria-label="Why shop with us">
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
      <section className="landing-visit mx-auto max-w-7xl px-4 py-6" aria-labelledby="visit-heading">
        <SectionHeader title="Visit or reach us" subtitle={PHARMACY.legalName} />
        <h2 id="visit-heading" className="sr-only">
          Pharmacy location and contact
        </h2>
        <div className="grid gap-4 lg:grid-cols-5">
          {/* pharmacist photo */}
          <figure className="img-frame group relative aspect-[4/3] self-start lg:col-span-2">
            <Image
              src="/images/pharmacist-consult.png"
              alt="A friendly Medivyx pharmacist handing medicine to a customer over the counter"
              width={1152}
              height={864}
              sizes="(max-width: 1024px) calc(100vw - 32px), 40vw"
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
                    href={waLink("Hello Medivyx!")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    WhatsApp us on {PHARMACY.phoneDisplay}
                  </a>
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <a href={`tel:${PHARMACY.phone}`}>
                    <Phone className="h-4 w-4" /> Call
                  </a>
                </Button>
                <Button asChild size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                  <a href={waLink("Hello Medivyx! I'd like to make an enquiry.")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                </Button>
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
                <Button asChild size="sm" className="relative mt-4 gap-1.5">
                  <a href={PHARMACY.mapsUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="h-4 w-4" /> Open in Google Maps
                  </a>
                </Button>
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
      <section className="landing-faq mx-auto max-w-3xl px-4 py-10" aria-labelledby="faq-heading">
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
