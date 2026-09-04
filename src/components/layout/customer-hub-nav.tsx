"use client"

import { useAppStore, type ViewName } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ClipboardList, FileText, LayoutDashboard, ShoppingBag, UserRound, CalendarDays } from "lucide-react"

const destinations: { label: string; view: ViewName; icon: typeof LayoutDashboard; matches: ViewName[]; params?: Record<string, string> }[] = [
  { label: "Overview", view: "account", icon: LayoutDashboard, matches: ["account"] },
  { label: "Orders", view: "orders", icon: ClipboardList, matches: ["orders", "order"] },
  { label: "Prescriptions", view: "prescriptions", icon: FileText, matches: ["prescriptions"] },
  { label: "Appointments", view: "services", icon: CalendarDays, matches: [], params: { tab: "bookings" } },
]

export function CustomerHubNav() {
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const session = useAuthStore((s) => s.session)

  if (session?.role !== "CUSTOMER") return null

  const firstName = session.user?.name?.trim().split(/\s+/)[0] || "there"

  return (
    <section className="customer-hub" aria-label="Customer account navigation">
      <div className="customer-hub-inner">
        <div className="customer-hub-identity">
          <span className="customer-hub-avatar" aria-hidden><UserRound className="h-5 w-5" /></span>
          <span><small>My Sphere</small><strong>Hi, {firstName}</strong></span>
        </div>
        <nav className="customer-hub-links" aria-label="My Sphere">
          {destinations.map((item) => {
            const active = item.matches.includes(view)
            return (
              <button key={item.label} onClick={() => navigate(item.view, item.params)} aria-current={active ? "page" : undefined} className={cn("customer-hub-link", active && "is-active")}>
                <item.icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
        <Button size="sm" className="customer-hub-shop" onClick={() => navigate("catalog")}>
          <ShoppingBag className="h-4 w-4" aria-hidden /> Shop health essentials
        </Button>
      </div>
    </section>
  )
}
