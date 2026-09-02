"use client"

import { FormEvent, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LogoFull } from "@/components/shared/logo"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { PHARMACY, waLink } from "@/lib/constants"
import { MessageCircle, Phone, Search, ShoppingCart, Heart, User, MapPin, Clock, Truck } from "lucide-react"

export function ReferenceHomeChrome({ children }: { children?: React.ReactNode }) {
  const navigate = useAppStore((s) => s.navigate)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const cartCount = useCartStore((s) => s.lines.reduce((n, line) => n + line.qty, 0))
  const [query, setQuery] = useState("")

  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const value = query.trim()
    if (!value) return
    setCatalogFilters({ search: value })
    navigate("catalog")
  }

  return (
    <>
      <header className="reference-header">
        <div className="reference-topbar">
          <div className="reference-container reference-topbar-inner">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />Open now · {PHARMACY.hoursLabel}</span>
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
            <Button variant="outline" size="icon" className="reference-icon-button" aria-label="Wishlist"><Heart className="h-5 w-5" /></Button>
            <Button variant="outline" size="icon" className="reference-icon-button relative" onClick={() => navigate("cart")} aria-label={`Cart with ${cartCount} items`}><ShoppingCart className="h-5 w-5" />{cartCount > 0 ? <span className="reference-badge">{cartCount}</span> : null}</Button>
            <Button variant="outline" className="reference-action-button" onClick={() => navigate("account")}><User className="h-4 w-4" />Account</Button>
          </div>
        </div>

        <nav className="reference-nav">
          <div className="reference-container reference-nav-inner">
            <button className="reference-nav-active" onClick={() => navigate("home")}>Home</button>
            <button onClick={() => navigate("catalog")}>Shop</button>
            <button onClick={() => navigate("orders")}>My orders</button>
            <button onClick={() => navigate("prescriptions")}>Prescriptions</button>
            <button onClick={() => navigate("account")}>Account</button>
            <span className="reference-delivery-pill"><Truck className="h-4 w-4" /> Free delivery in Roysambu on orders over KSh 3,000</span>
          </div>
        </nav>
      </header>
      {children}
    </>
  )
}
