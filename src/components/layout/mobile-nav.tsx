"use client"

// Mobile bottom tab bar — one-tap access to the five core destinations.
// Hidden on desktop (header quick-nav takes over) and on views where a stray
// tap could interrupt a flow in progress (checkout keeps its own chrome,
// admin has its own layout).

import { useAppStore, type ViewName } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { cn } from "@/lib/utils"
import { Home, Pill, Upload, ShoppingCart, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

const TABS: { label: string; icon: typeof Home; view: ViewName; match: ViewName[] }[] = [
  { label: "Home", icon: Home, view: "home", match: ["home"] },
  { label: "Shop", icon: Pill, view: "catalog", match: ["catalog", "product"] },
  { label: "Rx", icon: Upload, view: "prescriptions", match: ["prescriptions"] },
  { label: "Cart", icon: ShoppingCart, view: "cart", match: ["cart"] },
  { label: "Account", icon: User, view: "account", match: ["account", "orders", "order", "auth"] },
]

export function MobileNav() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const cartCount = useCartStore((s) => s.lines.reduce((n, l) => n + l.qty, 0))

  // checkout keeps users focused with its own stepper; admin has its own layout
  if (view === "checkout" || view === "admin") return null

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match.includes(view)
          return (
            <li key={tab.view}>
              <button
                onClick={() => navigate(tab.view)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-full flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative">
                  <tab.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} aria-hidden />
                  {tab.view === "cart" && cartCount > 0 ? (
                    <Badge className="absolute -right-2.5 -top-1.5 h-4 min-w-4 rounded-full bg-rose-600 px-1 text-[11px] font-bold leading-none text-white">
                      {cartCount > 99 ? "99+" : cartCount}
                    </Badge>
                  ) : null}
                </span>
                {tab.label}
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
      {/* safe-area padding for iPhones with a home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  )
}
