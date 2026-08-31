"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Toaster } from "@/components/ui/sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { RxFlagBadge } from "@/components/shared/status-badges"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { useAuthStore } from "@/store/use-auth-store"
import { waLink, PHARMACY, DELIVERY_DEFAULTS } from "@/lib/constants"
import { formatKES } from "@/lib/format"
import { toast } from "sonner"
import { ShoppingCart, Minus, Plus, Trash2, FileWarning, ArrowRight, MessageCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

// ============================== VIEW ==============================

export function CartView() {
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const lines = useCartStore((s) => s.lines)
  const setQty = useCartStore((s) => s.setQty)
  const remove = useCartStore((s) => s.remove)
  const session = useAuthStore((s) => s.session)

  const [notice, setNotice] = useState<string | null>(null)

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const count = lines.reduce((n, l) => n + l.qty, 0)
  const rxLines = lines.filter((l) => l.requiresPrescription)
  const loggedIn = !!session?.user

  function handleCheckout() {
    if (!loggedIn && rxLines.length > 0) {
      setNotice(
        "Prescription items need an account so our pharmacist can review and link your prescription. Log in or create one — it takes a minute."
      )
      openAuth("login", "checkout", "Log in to continue — prescription items require an account.")
      return
    }
    setNotice(null)
    navigate("checkout")
  }

  function handleRemove(name: string, productId: string) {
    remove(productId)
    toast.success(`${name} removed from cart`)
  }

  // ---------- empty ----------
  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Toaster position="bottom-left" richColors closeButton />
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse the catalogue and add medicines, vitamins or health devices — we deliver across Nairobi or you can pick up on Lumumba Drive."
          action={{ label: "Browse products", onClick: () => navigate("catalog") }}
        />
        <div className="mt-6 flex justify-center">
          <a href={waLink("Hello Sphere Pharmacy! I'd like help placing an order.")} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-1.5 rounded-full">
              <MessageCircle className="h-4 w-4 text-emerald-600" /> Need help? Order via WhatsApp
            </Button>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-10">
      <Toaster position="bottom-left" richColors closeButton />

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
                    {/* emoji tile */}
                    <button
                      onClick={() => navigate("product", { productId: l.productId })}
                      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-50 to-emerald-50 text-3xl dark:from-teal-950/40 dark:to-emerald-950/30 sm:h-20 sm:w-20 sm:text-4xl"
                      aria-label={`View ${l.name}`}
                    >
                      <span aria-hidden>{l.image ?? "💊"}</span>
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
                            {l.requiresPrescription ? <RxFlagBadge compact /> : <Badge variant="outline" className="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">OTC</Badge>}
                            {unavailable ? (
                              <Badge variant="outline" className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
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
                            onClick={() => setQty(l.productId, l.qty - 1)}
                            aria-label={`Decrease ${l.name} quantity`}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => setQty(l.productId, l.qty + 1)}
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
          <aside aria-label="Order summary">
            <Card className="sticky top-36">
              <CardContent className="space-y-4 p-6">
                <h2 className="text-base font-bold">Order summary</h2>

                {rxLines.length > 0 ? (
                  <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
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

                <Button size="lg" className="h-12 w-full gap-2 rounded-full text-base" onClick={handleCheckout}>
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
      </div>
    </div>
  )
}
