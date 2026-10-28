"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/shared/empty-state"
import { ProductImage } from "@/components/shared/product-image"
import { OtcBadge, RxFlagBadge } from "@/components/shared/status-badges"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { useAuthStore } from "@/store/use-auth-store"
import { waLink, PHARMACY, DELIVERY_DEFAULTS } from "@/lib/constants"
import { formatKES } from "@/lib/format"
import { toast } from "sonner"
import { promotionsApi } from "@/lib/api-client"
import type { PromotionDTO } from "@/lib/types"
import { ShoppingCart, Minus, Plus, Trash2, FileWarning, ArrowRight, MessageCircle, Info, Gift } from "lucide-react"
import { cn } from "@/lib/utils"

// ============================== VIEW ==============================

export function CartView() {
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const savedPromo = useCartStore((s) => s.appliedPromo)
  const clearSavedPromo = useCartStore((s) => s.clearAppliedPromo)
  const remove = useCartStore((s) => s.remove)
  const session = useAuthStore((s) => s.session)

  const [notice, setNotice] = useState<string | null>(null)
  const [offers, setOffers] = useState<PromotionDTO[]>([])
  useEffect(() => {
    let active=true
    promotionsApi.list().then(list=>{if(active)setOffers(list.filter(p=>p.code&&p.discountPct).slice(0,3))}).catch(()=>{})
    return()=>{active=false}
  }, [])

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const rxLines = lines.filter((l) => l.requiresPrescription)
  const loggedIn = !!session?.user

  function handleCheckout() {
    if (!loggedIn) {
      setNotice("Sign in first so your cart stays exactly where you left it. After signing in, you’ll return straight to checkout.")
      openAuth("login", "checkout", rxLines.length > 0
        ? "Sign in to continue — your cart is saved and you’ll return straight to prescription checkout."
        : "Sign in to continue — your cart is saved and you’ll return straight to checkout.")
      return
    }
    setNotice(null)
    navigate("checkout")
  }

  function updateQty(productId: string, qty: number) {
    const previousOffer = useCartStore.getState().appliedPromo
    setQty(productId, qty)
    const updatedCart = useCartStore.getState()
    if (previousOffer && !updatedCart.appliedPromo && updatedCart.lines.length > 0) {
      toast.info("Promotion removed", { description: "Your cart no longer meets this offer's minimum spend." })
    }
  }

  function handleRemove(name: string, productId: string) {
    const previousOffer = useCartStore.getState().appliedPromo
    remove(productId)
    const updatedCart = useCartStore.getState()
    toast.success(`${name} removed from cart`, {
      description: previousOffer && !updatedCart.appliedPromo && updatedCart.lines.length > 0
        ? "Your cart no longer meets the promotion's minimum spend, so the code was removed."
        : undefined,
    })
  }

  // ---------- empty ----------
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse the catalogue and add medicines, vitamins or health devices — we deliver across Nairobi or you can pick up on Lumumba Drive."
          action={{ label: "Browse products", onClick: () => navigate("catalog") }}
        />
        <div className="mt-6 flex justify-center">
          <Button asChild variant="outline" className="gap-1.5 rounded-full">
            <a href={waLink("Hello Sphere Pharmacy! I'd like help placing an order.")} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 text-emerald-700" /> Need help? Order via WhatsApp
            </a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page app-page-cart pb-10">

      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Your cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count} item{count === 1 ? "" : "s"} · {rxLines.length > 0 ? `${rxLines.length} prescription item${rxLines.length === 1 ? "" : "s"} requiring review` : "no prescription items"}
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* ============ LINES ============ */}
          <section aria-label="Cart items" className="space-y-3">
            {lines.map((l) => {
              const unavailable = l.stockStatus === "OUT_OF_STOCK" || l.stockStatus === "DISCONTINUED"
              return (
                <Card key={l.productId} className={cn("card-lift", unavailable && "opacity-70")}>
                  <CardContent className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                    {/* product photo */}
                    <button
                      onClick={() => navigate("product", { productId: l.productId })}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted sm:h-20 sm:w-20"
                      aria-label={`View ${l.name}`}
                    >
                      <ProductImage src={l.image} alt={l.name} className="h-full w-full" />
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <button
                            onClick={() => navigate("product", { productId: l.productId })}
                            className="line-clamp-2 text-left text-sm font-semibold leading-tight hover:text-primary hover:underline sm:text-base"
                          >
                            {l.name}
                          </button>
                          <p className="mt-0.5 text-xs text-muted-foreground">{l.packSize ?? "Standard pack"}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {l.requiresPrescription ? <RxFlagBadge compact className="sphere-cart-rx-badge" /> : <OtcBadge className="sphere-cart-otc-badge" />}
                            {unavailable ? (
                              <Badge variant="outline" className="sphere-cart-stock-badge border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                                Out of stock
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-bold sm:text-base">{formatKES(l.price * l.qty)}</span>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <div className="flex items-center rounded-full border" role="group" aria-label={`Quantity for ${l.name}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => updateQty(l.productId, l.qty - 1)}
                            aria-label={`Decrease ${l.name} quantity`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => updateQty(l.productId, l.qty + 1)}
                            aria-label={`Increase ${l.name} quantity`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatKES(l.price)} each</span>
                        <button
                          onClick={() => handleRemove(l.name, l.productId)}
                          className="ml-auto rounded-full p-2 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                          aria-label={`Remove ${l.name} from cart`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <Button variant="ghost" className="gap-1.5 rounded-full" onClick={() => navigate("catalog")}>
              <ArrowRight className="h-4 w-4 rotate-180" /> Continue shopping
            </Button>
          </section>

          {/* ============ SUMMARY ============ */}
          <aside className="cart-summary" aria-label="Order summary">
            <Card className="sticky top-36">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-base font-bold">Order summary</h2>

                {rxLines.length > 0 ? (
                  <div role="note" className="sphere-cart-rx-notice flex gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <p>
                      Your cart includes prescription-only items. You&apos;ll upload your prescription at checkout — a
                      pharmacist verifies it before dispensing.{" "}
                      {!loggedIn ? "Prescription orders need an account." : ""}
                    </p>
                  </div>
                ) : (
                  <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    No prescription items — you can check out as a guest in under a minute.
                  </p>
                )}

                {notice ? (
                  <div role="alert" className="rounded-xl border border-amber-300 bg-amber-100/70 p-3 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                    {notice}
                  </div>
                ) : null}

                {savedPromo ? (
                  <div className="sphere-cart-offer flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                    <div className="min-w-0">
                      <p className="sphere-offer-title text-xs font-bold">Saved code · <span className="font-mono">{savedPromo.code}</span></p>
                      <p className="sphere-offer-detail mt-1 text-xs">Your discount will be verified again at checkout.</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="sphere-offer-action h-8 shrink-0" onClick={clearSavedPromo}>Remove</Button>
                  </div>
                ) : null}

                {offers.length > 0 ? (
                  <div className="space-y-2" aria-label="Available checkout offers">
                    <p className="flex items-center gap-2 text-xs font-bold text-foreground"><Gift className="h-4 w-4 text-primary"/> Available offers</p>
                    {offers.slice(0,2).map(offer=>(
                      <div key={offer.id} className="sphere-cart-offer flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 dark:border-emerald-800 dark:bg-emerald-950/30">
                        <div className="min-w-0">
                          <p className="sphere-offer-title truncate text-xs font-semibold text-emerald-950 dark:text-emerald-100">{offer.discountPct}% off · <span className="font-mono">{offer.code}</span></p>
                          <p className="sphere-offer-detail mt-0.5 text-xs text-emerald-800 dark:text-emerald-300">{offer.minimumSpend && subtotal < offer.minimumSpend ? `Add ${formatKES(offer.minimumSpend-subtotal)} to qualify` : offer.minimumSpend ? `Min. ${formatKES(offer.minimumSpend)}` : "No minimum spend"}</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="sphere-offer-action h-8 shrink-0 rounded-lg" disabled={(!!offer.minimumSpend && subtotal < offer.minimumSpend) || savedPromo?.code === offer.code} onClick={()=>{
                          if(!loggedIn&&offer.perUserLimit!=null){
                            openAuth("login","checkout","Sign in to redeem this promotion.",{promo:offer.code!})
                          }else navigate("checkout",{promo:offer.code!})
                        }}>{savedPromo?.code === offer.code ? "Selected" : "Use"}</Button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <button type="button" onClick={() => navigate("offers")} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View all current offers <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({count} item{count === 1 ? "" : "s"})</span>
                    <span className="font-semibold">{formatKES(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">Total before delivery</span>
                  <span className="text-xl font-extrabold text-primary">{formatKES(subtotal)}</span>
                </div>

                <Button size="lg" className="cart-checkout-action h-12 w-full gap-2 rounded-full text-base" onClick={handleCheckout}>
                  Proceed to checkout <ArrowRight className="h-4 w-4" />
                </Button>

                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  Pickup is free · delivery fees by zone · free delivery on orders over {formatKES(DELIVERY_DEFAULTS.freeOver ?? 3000)} ·{" "}
                  <a href={`tel:${PHARMACY.phone}`} className="underline hover:text-foreground">
                    or call {PHARMACY.phoneDisplay}
                  </a>
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>

        <div className="cart-mobile-checkout" aria-label="Cart total and checkout">
          <span>
            <small>{count} item{count === 1 ? "" : "s"}</small>
            <strong>{formatKES(subtotal)}</strong>
          </span>
          <Button size="lg" className="h-12 flex-1 gap-2 rounded-full text-base" onClick={handleCheckout}>
            Checkout <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
