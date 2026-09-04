"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ProductCardCompact } from "@/components/shared/product-card"
import { ProductImage } from "@/components/shared/product-image"
import { LogoFull } from "@/components/shared/logo"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { useWishStore } from "@/store/use-wish-store"
import { catalogApi } from "@/lib/api-client"
import type { ProductDTO } from "@/lib/types"
import { formatKES, isOpenNow } from "@/lib/format"
import { PHARMACY } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import {
  Search, ShoppingCart, Phone, Menu, X, Home, Pill, Package, Upload, User,
  LayoutDashboard, Trash2, Minus, Plus, ChevronRight, MapPin, Loader2,
  Heart, HeartPulse, Sun, Moon, Tag
} from "lucide-react"

export function Header() {
  const navigate = useAppStore((s) => s.navigate)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const view = useAppStore((s) => s.view)
  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.qty, 0))
  const wishCount = useWishStore((s) => s.items.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const open = isOpenNow()

  // theme toggle — useSyncExternalStore gives a hydration-safe "mounted" guard
  // (false during SSR/hydration, true on the client after hydration) without setState-in-effect
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
  const dark = resolvedTheme === "dark"

  const navItems = [
    { label: "Home", icon: Home, view: "home" as const },
    { label: "Shop", icon: Pill, view: "catalog" as const },
    { label: "Services", icon: HeartPulse, view: "services" as const },
    { label: "My orders", icon: Package, view: "orders" as const },
    { label: "Prescriptions", icon: Upload, view: "prescriptions" as const },
    { label: "Account", icon: User, view: "account" as const },
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* top strip: hours + contact */}
      <div className="hidden border-b bg-primary text-primary-foreground sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5 text-xs">
          <div className="flex items-center gap-4">
            <span className={cn("flex items-center gap-1.5 font-medium", open ? "text-emerald-100" : "text-amber-100")}>
              <span className={cn("pulse-dot inline-block h-1.5 w-1.5 rounded-full", open ? "bg-emerald-200" : "bg-amber-300")} />
              {open ? "Open now" : "Closed"} · {PHARMACY.hoursLabel}
            </span>
            <a href={`tel:${PHARMACY.phone}`} className="flex items-center gap-1 hover:underline">
              <Phone className="h-3 w-3" /> {PHARMACY.phoneDisplay}
            </a>
          </div>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> {PHARMACY.address}
          </span>
        </div>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        {/* mobile menu */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b p-4">
              <SheetTitle><LogoFull /></SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 p-3">
              {navItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => { navigate(item.view); setMenuOpen(false) }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    view === item.view
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "hover:bg-accent/60"
                  )}
                >
                  <item.icon className="h-4 w-4" /> {item.label}
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              <Separator className="my-2" />
              <a
                href={`https://wa.me/${PHARMACY.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Order via WhatsApp
              </a>
              <a
                href={`tel:${PHARMACY.phone}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium hover:bg-accent/60"
              >
                <Phone className="h-4 w-4" /> Call pharmacy
              </a>
            </nav>
          </SheetContent>
        </Sheet>

        {/* logo (wordmark hidden <sm via .logo-compact so icon cluster never overflows phones) */}
        <button onClick={() => navigate("home")} className="shrink-0" aria-label="Sphere Pharmacy home">
          <LogoFull className="logo-compact" />
        </button>

        {/* search (desktop) */}
        <div className="relative ml-4 hidden flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search products">
            <Search className="h-5 w-5" />
          </Button>
          <Button asChild variant="outline" size="sm" className="hidden gap-1.5 lg:inline-flex">
            <a href={`tel:${PHARMACY.phone}`}>
              <Phone className="h-4 w-4" /> Call
            </a>
          </Button>
          <Button asChild size="sm" className="hidden gap-1.5 bg-emerald-700 hover:bg-emerald-800 lg:inline-flex">
            <a href={`https://wa.me/${PHARMACY.whatsapp}?text=${encodeURIComponent("Hello Sphere Pharmacy! I'd like to place an order.")}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          </Button>

          {/* wishlist */}
          <WishSheet />

          {/* dark mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            {mounted ? (
              dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5 opacity-0" />
            )}
          </Button>

          {/* cart */}
          <CartSheet />

          {/* account / admin quick access */}
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-1.5 md:inline-flex"
            onClick={() => navigate("account")}
          >
            <User className="h-4 w-4" /> Account
          </Button>
        </div>
      </div>

      {/* mobile search bar (toggle) */}
      {searchOpen ? (
        <div className="border-t p-3 md:hidden">
          <div className="relative">
            <SearchBar onNavigate={() => setSearchOpen(false)} />
            <button className="absolute right-10 top-1/2 -translate-y-1/2" onClick={() => setSearchOpen(false)} aria-label="Close search">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      ) : null}

      {/* desktop quick nav */}
      <nav className="hidden border-t md:block">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1.5">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === item.view
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Tag className="h-3 w-3" aria-hidden /> Free delivery in Roysambu on orders over KSh 3,000
          </span>
        </div>
      </nav>
    </header>
  )
}

// ---------- Search with dropdown results ----------

function SearchBar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useAppStore((s) => s.navigate)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const [q, setQ] = useState("")
  const [results, setResults] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const res = await catalogApi.products({ search: q.trim(), pageSize: 6 })
        setResults(res.items)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [q])

  function submit() {
    if (!q.trim()) return
    setCatalogFilters({ search: q.trim() })
    navigate("catalog")
    setFocused(false)
    onNavigate?.()
  }

  const showDropdown = focused && q.trim().length >= 2

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Search medicines, vitamins, devices…"
        className="h-10 rounded-full border-muted bg-muted/50 pl-9 pr-24 text-sm"
        aria-label="Search products"
      />
      <Button size="sm" className="absolute right-1 top-1/2 h-8 -translate-y-1/2 rounded-full px-4" onClick={submit}>
        Search
      </Button>

      {showDropdown ? (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No products found for “{q}”. Try the catalogue browse or WhatsApp us.</div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="flex flex-col gap-1 p-2">
                {results.map((p) => (
                  <ProductCardCompact key={p.id} product={p} />
                ))}
                <button
                  onClick={submit}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-accent/60 px-3 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent"
                >
                  View all results <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </ScrollArea>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ---------- Wishlist sheet ----------

export function WishSheet() {
  const navigate = useAppStore((s) => s.navigate)
  const items = useWishStore((s) => s.items)
  const remove = useWishStore((s) => s.remove)
  const add = useCartStore((s) => s.add)
  const cartLines = useCartStore((s) => s.lines)
  const [open, setOpen] = useState(false)

  function addSavedItem(item: (typeof items)[number]) {
    add({ productId: item.productId, name: item.name, price: item.price, image: item.image, requiresPrescription: item.requiresPrescription, packSize: item.packSize, stockStatus: "IN_STOCK" })
    toast.success(`${item.name} added to cart`, { action: { label: "View cart", onClick: () => { setOpen(false); navigate("cart") } } })
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={`Wishlist with ${items.length} saved items`}>
          <Heart className="h-5 w-5" />
          {items.length > 0 ? (
            <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
              {items.length}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Heart className="h-4 w-4 text-rose-600" /> Saved items ({items.length})
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Kept on this device — tap the heart on any product to save it for later.
          </SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <Heart className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No saved items yet. Browse the shop and tap the heart on products you want to remember.</p>
            <Button variant="outline" onClick={() => { setOpen(false); navigate("catalog") }}>
              Browse products
            </Button>
          </div>
        ) : (
          <ScrollArea className="scroll-slim flex-1 p-4">
            <div className="flex flex-col gap-3">
              {items.map((w) => {
                const savedQty = cartLines.find((line) => line.productId === w.productId)?.qty ?? 0
                return (
                <div key={w.productId} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <ProductImage src={w.image} alt={w.name} className="h-14 w-14 shrink-0 rounded-lg bg-muted object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.brand ?? "Sphere Pharmacy"}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">{formatKES(w.price)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="sm" onClick={() => addSavedItem(w)} className="h-8 px-3">
                      {savedQty > 0 ? `Add another · ${savedQty}` : "Add to cart"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(w.productId)} className="h-8 px-3 text-xs text-destructive">Remove</Button>
                  </div>
                </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ---------- Cart sheet ----------

function CartSheet() {
  const lines = useCartStore((s) => s.lines)
  const add = useCartStore((s) => s.add)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const navigate = useAppStore((s) => s.navigate)
  const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0)

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={`Cart with ${lines.length} different products`}>
          <ShoppingCart className="h-5 w-5" />
          {lines.length > 0 ? (
            <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
              {lines.reduce((n, l) => n + l.qty, 0)}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-base">Your cart ({lines.reduce((n, l) => n + l.qty, 0)})</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">Review your items before checkout.</SheetDescription>
        </SheetHeader>
        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Your cart is empty.</p>
          </div>
        ) : (
          <ScrollArea className="scroll-slim flex-1 p-4">
            <div className="flex flex-col gap-3">
              {lines.map((line) => (
                <div key={line.productId} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <ProductImage src={line.image} alt={line.name} className="h-14 w-14 shrink-0 rounded-lg bg-muted object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{line.packSize ?? "Sphere Pharmacy"}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">{formatKES(line.price * line.qty)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(line.productId, line.qty - 1)} aria-label={`Decrease ${line.name}`}><Minus className="h-3.5 w-3.5" /></Button>
                    <span className="min-w-7 text-center text-sm">{line.qty}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setQty(line.productId, line.qty + 1)} aria-label={`Increase ${line.name}`}><Plus className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(line.productId)} aria-label={`Remove ${line.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        {lines.length > 0 ? (
          <div className="border-t p-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-bold">{formatKES(total)}</span>
            </div>
            <Button className="w-full" onClick={() => navigate("cart")}>Go to checkout</Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
