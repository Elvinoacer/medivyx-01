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
  Heart, Sun, Moon, Tag
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
                    view === item.view ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
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
          <a href={`tel:${PHARMACY.phone}`} className="hidden lg:inline-flex">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Phone className="h-4 w-4" /> Call
            </Button>
          </a>
          <a href={`https://wa.me/${PHARMACY.whatsapp}?text=${encodeURIComponent("Hello Sphere Pharmacy! I'd like to place an order.")}`} target="_blank" rel="noopener noreferrer" className="hidden lg:inline-flex">
            <Button size="sm" className="gap-1.5 bg-emerald-700 hover:bg-emerald-800">
              WhatsApp
            </Button>
          </a>

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
                view === item.view ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
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
  const [open, setOpen] = useState(false)

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
              {items.map((w) => (
                <div key={w.productId} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <button
                    onClick={() => { setOpen(false); navigate("product", { productId: w.productId }) }}
                    className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted"
                    aria-label={`View ${w.name}`}
                  >
                    <ProductImage src={w.image} alt={w.name} className="h-full w-full" />
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate("product", { productId: w.productId }) }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {w.brand ?? ""}{w.brand && w.packSize ? " · " : ""}{w.packSize ?? ""} · {formatKES(w.price)}
                      {w.requiresPrescription ? " · ℞" : ""}
                    </p>
                  </button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      add({
                        productId: w.productId,
                        name: w.name,
                        price: w.price,
                        image: w.image,
                        requiresPrescription: w.requiresPrescription,
                        packSize: w.packSize,
                        stockStatus: "IN_STOCK",
                      })
                      toast.success(`${w.name} added to cart`)
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    onClick={() => { remove(w.productId); toast("Removed from saved items") }}
                    className="text-muted-foreground hover:text-rose-600"
                    aria-label={`Remove ${w.name} from wishlist`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function CartSheet() {
  const navigate = useAppStore((s) => s.navigate)
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const subtotal = useCartStore((s) => s.subtotal())
  const [open, setOpen] = useState(false)
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const hasRx = lines.some((l) => l.requiresPrescription)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={`Cart with ${count} items`}>
          <ShoppingCart className="h-5 w-5" />
          {count > 0 ? (
            <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full px-1 text-[11px] font-bold">
              {count}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <ShoppingCart className="h-4 w-4" /> Your cart ({count})
          </SheetTitle>
        </SheetHeader>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Your cart is empty.</p>
            <Button variant="outline" onClick={() => { setOpen(false); navigate("catalog") }}>
              Browse products
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="scroll-slim flex-1 p-4">
              <div className="flex flex-col gap-3">
                {lines.map((l) => (
                  <div key={l.productId} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <button
                      onClick={() => navigate("product", { productId: l.productId })}
                      className="h-11 w-11 shrink-0 overflow-hidden rounded-md border bg-muted"
                      aria-label={`View ${l.name}`}
                    >
                      <ProductImage src={l.image} alt={l.name} className="h-full w-full" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatKES(l.price)} {l.requiresPrescription ? "· ℞ Rx" : ""}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setQty(l.productId, l.qty - 1)} aria-label="Decrease quantity">
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold">{l.qty}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setQty(l.productId, l.qty + 1)} aria-label="Increase quantity">
                          <Plus className="h-3 w-3" />
                        </Button>
                        <button onClick={() => remove(l.productId)} className="ml-auto text-muted-foreground hover:text-rose-600" aria-label={`Remove ${l.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <span className="text-sm font-bold">{formatKES(l.price * l.qty)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-3 border-t p-4">
              {hasRx ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  Your cart includes prescription-only items. You&apos;ll be asked to upload a prescription at checkout — a pharmacist verifies it before dispensing.
                </p>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-lg font-bold">{formatKES(subtotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Delivery fee calculated at checkout. Prescription items only dispensed after pharmacist review.</p>
              <div className="grid gap-2">
                <Button className="h-11 w-full text-base" onClick={() => { setOpen(false); navigate("checkout") }}>
                  Checkout <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { setOpen(false); navigate("cart") }}>
                  View full cart
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
