"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import { FormEvent, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogoFull } from "@/components/shared/logo"
import { WishSheet } from "@/components/layout/header"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { PHARMACY, DELIVERY_DEFAULTS, waLink } from "@/lib/constants"
import { formatKES, isOpenNow } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import {
  ArrowRight,
  Check,
  Clock3,
  CreditCard,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Truck,
  Upload,
  User,
} from "lucide-react"

const ServicesShowcase = dynamic(() =>
  import("@/components/home/services-showcase").then((module) => module.ServicesShowcase)
)

export function ReferenceHomeHero({ showHero = true }: { showHero?: boolean }) {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const cartCount = useCartStore((s) => s.lines.reduce((n, line) => n + line.qty, 0))
  const [query, setQuery] = useState("")
  const open = isOpenNow()
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const dark = resolvedTheme === "dark"

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const value = query.trim()
    if (!value) return
    setCatalogFilters({ search: value })
    navigate("catalog")
  }

  const navItems = [
    { label: "Home", view: "home" as const },
    { label: "Shop", view: "catalog" as const },
    { label: "Care services", view: "services" as const },
    { label: "My orders", view: "orders" as const },
    { label: "Account", view: "account" as const },
  ]

  return (
    <div className={cn("reference-home-shell", !showHero && "reference-home-shell-compact")}>
      <header className="reference-header">
        <div className="reference-topbar">
          <div className="reference-container reference-topbar-inner">
            <div className="reference-topbar-group">
              <span className={cn("reference-status", !open && "reference-status-closed")}>
                <span className="reference-status-dot" />
                {open ? "Open now" : "Closed"}
              </span>
              <span>{PHARMACY.hoursLabel}</span>
            </div>
            <div className="reference-topbar-group">
              <a href={`tel:${PHARMACY.phone}`}><Phone aria-hidden />{PHARMACY.phoneDisplay}</a>
              <a href={PHARMACY.mapsUrl} target="_blank" rel="noreferrer"><MapPin aria-hidden />{PHARMACY.address}</a>
            </div>
          </div>
        </div>

        <div className="reference-nav-wrap">
          <div className="reference-container reference-mainbar">
            <button onClick={() => navigate("home")} className="reference-brand" aria-label="Medivyx home">
              <LogoFull className="reference-logo" dark={dark} />
            </button>

            <nav className="reference-nav" aria-label="Primary navigation">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  className={cn("reference-nav-button", view === item.view && "reference-nav-active")}
                  onClick={() => navigate(item.view)}
                  aria-current={view === item.view ? "page" : undefined}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="reference-actions">
              <WishSheet />
              <Button variant="ghost" size="icon" className="reference-icon-button" onClick={() => navigate("cart")} aria-label={`Cart with ${cartCount} items`}>
                <ShoppingCart aria-hidden />
                {cartCount > 0 ? <span className="reference-badge">{cartCount > 99 ? "99+" : cartCount}</span> : null}
              </Button>
              <Button variant="ghost" size="icon" className="reference-icon-button reference-theme-button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
                {mounted ? (dark ? <Sun aria-hidden /> : <Moon aria-hidden />) : <Moon className="opacity-0" aria-hidden />}
              </Button>
              <Button className="reference-account-button" onClick={() => navigate("prescriptions")}>
                <Upload aria-hidden /> Upload prescription
              </Button>
            </div>

            <div className="reference-mobile-actions">
              <Button variant="ghost" size="icon" onClick={() => navigate("catalog")} aria-label="Search the catalogue"><Search aria-hidden /></Button>
              <Button variant="ghost" size="icon" className="relative" onClick={() => navigate("cart")} aria-label={`Open cart with ${cartCount} items`}>
                <ShoppingCart aria-hidden />
                {cartCount > 0 ? <span className="reference-badge">{cartCount > 99 ? "99+" : cartCount}</span> : null}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigate("account")} aria-label="Open your account"><User aria-hidden /></Button>
            </div>
          </div>
        </div>
      </header>

      {showHero ? (
        <>
          <section className="reference-hero" aria-labelledby="home-hero-title">
            <div className="reference-hero-grain" aria-hidden />
            <div className="reference-hero-orb reference-hero-orb-one" aria-hidden />
            <div className="reference-hero-orb reference-hero-orb-two" aria-hidden />
            <div className="reference-container reference-hero-inner">
              <div className="reference-hero-copy">
                <div className="reference-eyebrow"><span />Independent care · Roysambu</div>
                <h1 id="home-hero-title">Care that feels <em>closer.</em></h1>
                <p className="reference-hero-description">
                  Trusted medicines, thoughtful pharmacist support, and same-day local delivery—beautifully simple, from search to doorstep.
                </p>

                <form onSubmit={submitSearch} className="reference-hero-search" role="search">
                  <Search aria-hidden />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search medicines, vitamins or devices"
                    aria-label="Search products"
                    enterKeyHint="search"
                  />
                  <Button type="submit" aria-label="Search products"><ArrowRight aria-hidden /></Button>
                </form>

                <div className="reference-hero-ctas">
                  <Button className="reference-primary-cta" onClick={() => navigate("catalog")}>
                    <ShoppingBag aria-hidden /> Shop health essentials
                  </Button>
                  <Button variant="outline" className="reference-secondary-cta" onClick={() => navigate("prescriptions")}>
                    <Upload aria-hidden /> Send a prescription
                  </Button>
                </div>

                <div className="reference-contact-row">
                  <a href={waLink("Hello Medivyx! I'd like to place an order.")} target="_blank" rel="noreferrer"><MessageCircle aria-hidden />Order on WhatsApp</a>
                  <span aria-hidden />
                  <a href={`tel:${PHARMACY.phone}`}><Phone aria-hidden />Speak to the pharmacy</a>
                </div>

                <div className="reference-proof-row" aria-label="Pharmacy benefits">
                  <span><Check aria-hidden />Pharmacist verified</span>
                  <span><Check aria-hidden />Private &amp; secure</span>
                  <span><Check aria-hidden />M-Pesa ready</span>
                </div>
              </div>

              <div className="reference-hero-visual">
                <div className="reference-visual-monogram" aria-hidden>MV</div>
                <figure className="reference-visual-frame">
                  <Image
                    src="/images/pharmacist-consult.png"
                    alt="A Medivyx pharmacist ready to help a customer"
                    fill
                    sizes="(max-width: 820px) calc(100vw - 28px), (max-width: 1200px) 47vw, 620px"
                    className="reference-visual-image"
                    fetchPriority="high"
                  />
                  <div className="reference-visual-overlay" aria-hidden />
                  <figcaption className="reference-visual-caption">
                    <span>Local expertise</span>
                    <strong>Real care, from real pharmacists.</strong>
                  </figcaption>
                </figure>

                <div className="reference-glass-card reference-pharmacist-card">
                  <span className="reference-glass-icon"><ShieldCheck aria-hidden /></span>
                  <span><small>Professional guidance</small><strong>Pharmacist on duty</strong></span>
                  <span className="reference-live-dot" aria-label="Available" />
                </div>

                <div className="reference-glass-card reference-delivery-card">
                  <span className="reference-glass-icon"><Truck aria-hidden /></span>
                  <span><small>Same-day delivery</small><strong>From {formatKES(DELIVERY_DEFAULTS.zones[0]?.fee ?? 150)}</strong></span>
                </div>
              </div>
            </div>

            <div className="reference-container reference-trust-strip">
              <div><Clock3 aria-hidden /><span><small>Convenient pickup</small><strong>Ready in about 2 hours</strong></span></div>
              <div><CreditCard aria-hidden /><span><small>Flexible checkout</small><strong>M-Pesa, card or cash</strong></span></div>
              <div><Truck aria-hidden /><span><small>Local delivery</small><strong>Free over KSh 3,000</strong></span></div>
              <div><ShieldCheck aria-hidden /><span><small>Prescription care</small><strong>Reviewed before dispensing</strong></span></div>
            </div>
          </section>
          <ServicesShowcase />
        </>
      ) : null}
    </div>
  )
}
