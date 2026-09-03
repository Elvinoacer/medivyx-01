"use client"

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
import { Search, Phone, MessageCircle, ShoppingCart, User, MapPin, Clock, Truck, ShieldCheck, Upload, ArrowRight, Sun, Moon } from "lucide-react"
import { ServicesShowcase } from "@/components/home/services-showcase"
import "@/app/services-showcase.css"

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
    { label: "My orders", view: "orders" as const },
    { label: "Prescriptions", view: "prescriptions" as const },
    { label: "Account", view: "account" as const },
  ]

  return (
    <div className={cn("reference-home-shell", !showHero && "reference-home-shell-compact")}>
      <header className="reference-header">
        <div className="reference-topbar">
          <div className="reference-container reference-topbar-inner">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{open ? "Open now" : "Closed"} · {PHARMACY.hoursLabel}</span>
              <span className="opacity-60">|</span>
              <a href={`tel:${PHARMACY.phone}`} className="flex items-center gap-2 hover:underline"><Phone className="h-3.5 w-3.5" />{PHARMACY.phoneDisplay}</a>
            </div>
            <span className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{PHARMACY.address}</span>
          </div>
        </div>
        <div className="reference-container reference-mainbar">
          <button onClick={() => navigate("home")} className="shrink-0" aria-label="Sphere Pharmacy home"><LogoFull className="reference-logo" /></button>
          <form onSubmit={submitSearch} className="reference-header-search">
            <Search className="h-5 w-5 text-slate-600" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicines, vitamins, devices..." className="h-full border-0 bg-transparent px-3 text-[15px] shadow-none focus-visible:ring-0" />
            <Button type="submit" className="reference-search-button">Search</Button>
          </form>
          <div className="reference-actions">
            <a href={`tel:${PHARMACY.phone}`}><Button variant="outline" className="reference-action-button"><Phone className="h-4 w-4" />Call</Button></a>
            <a href={waLink("Hello Sphere Pharmacy! I'd like to place an order.")} target="_blank" rel="noreferrer"><Button variant="outline" className="reference-action-button"><MessageCircle className="h-4 w-4 text-emerald-700" />WhatsApp</Button></a>
            <WishSheet />
            <Button variant="outline" size="icon" className="reference-icon-button relative" onClick={() => navigate("cart")} aria-label={`Cart with ${cartCount} items`}><ShoppingCart className="h-5 w-5" />{cartCount > 0 ? <span className="reference-badge">{cartCount}</span> : null}</Button>
            <Button variant="outline" size="icon" className="reference-icon-button" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setTheme(dark ? "light" : "dark")}>
              {mounted ? (dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />) : <Moon className="h-5 w-5 opacity-0" />}
            </Button>
            <Button variant="outline" className="reference-action-button" onClick={() => navigate("account")}><User className="h-4 w-4" />Account</Button>
          </div>
        </div>
        <nav className="reference-nav">
          <div className="reference-container reference-nav-inner">
            {navItems.map((item) => (
              <button key={item.view} className={cn("reference-nav-button", view === item.view && "reference-nav-active")} onClick={() => navigate(item.view)} aria-current={view === item.view ? "page" : undefined}>
                {item.label}
              </button>
            ))}
            <span className="reference-delivery-pill"><Truck className="h-4 w-4" /> Free delivery in Roysambu on orders over KSh 3,000</span>
          </div>
        </nav>
      </header>

      <section className="reference-hero">
        <div className="reference-container reference-hero-inner">
          <div className="reference-hero-copy">
            <div className={cn("reference-open-pill", !open && "reference-open-pill-closed")}><span className="reference-open-dot" />{open ? "Open now" : "Closed right now"} · {PHARMACY.hoursLabel}</div>
            <h1>Your pharmacy,<br /><span>now online.</span></h1>
            <p className="reference-hero-description">Order medicines, vitamins &amp; health devices for pickup on Lumumba Drive or enjoy same-day delivery — prescriptions reviewed by our pharmacist.</p>
            <form onSubmit={submitSearch} className="reference-hero-search">
              <Search className="h-5 w-5" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Panadol, amoxicillin, vitamins..." className="h-full border-0 bg-transparent px-2 text-[15px] shadow-none focus-visible:ring-0" />
              <Button type="submit" className="reference-search-button">Search</Button>
            </form>
            <div className="reference-hero-ctas">
              <Button size="lg" className="reference-primary-cta" onClick={() => navigate("catalog")}>Browse products <ArrowRight className="h-4 w-4" /></Button>
              <Button size="lg" variant="outline" className="reference-secondary-cta" onClick={() => navigate("prescriptions")}><Upload className="h-4 w-4" />Upload prescription</Button>
            </div>
            <div className="reference-contact-row">
              <a href={waLink("Hello Sphere Pharmacy! I'd like to place an order.")} target="_blank" rel="noreferrer" className="reference-whatsapp"><MessageCircle className="h-4 w-4" />Order via WhatsApp</a>
              <a href={`tel:${PHARMACY.phone}`} className="reference-phone"><Phone className="h-4 w-4" />{PHARMACY.phoneDisplay}</a>
            </div>
          </div>
          <div className="reference-hero-visual">
            <div className="reference-visual-glow" />
            <div className="reference-visual-frame">
              <div className="reference-visual-image" role="img" aria-label="Sphere Pharmacy interior" />
              <div className="reference-glass-card reference-pharmacist-card"><span className="reference-glass-icon"><ShieldCheck className="h-5 w-5" /></span><span><strong>Pharmacist-reviewed</strong><small>Every prescription verified</small></span></div>
              <div className="reference-glass-card reference-delivery-card"><span className="reference-glass-icon"><Truck className="h-5 w-5" /></span><span><strong>Same-day delivery</strong><small>Roysambu from {formatKES(DELIVERY_DEFAULTS.zones[0]?.fee ?? 150)}</small></span></div>
              <div className="reference-glass-stack">
                <div><Truck className="h-5 w-5" /><span><strong>Same-day delivery</strong><small>Roysambu from KSh 150</small></span></div>
                <div><ShieldCheck className="h-5 w-5" /><span><strong>Secure &amp; private</strong><small>Your health data is safe</small></span></div>
                <div><MessageCircle className="h-5 w-5" /><span><strong>Here to help</strong><small>Chat, call or WhatsApp our friendly support</small></span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="reference-trust-strip reference-container">
          <div><Clock className="h-6 w-6" /><span><strong>Pickup ready in ~2 hours</strong><small>Fast &amp; convenient</small></span></div>
          <div><span className="reference-payment-icon">▣</span><span><strong>M-Pesa · card · cash</strong><small>Multiple secure options</small></span></div>
          <div><MessageCircle className="h-6 w-6" /><span><strong>WhatsApp ordering</strong><small>Easy. Quick. Reliable.</small></span></div>
          <div><span className="reference-people-icon">♧</span><span><strong>Trusted by your community</strong><small>Local care you can count on</small></span></div>
        </div>
      </section>

      {showHero ? <ServicesShowcase /> : null}
    </div>
  )
}
