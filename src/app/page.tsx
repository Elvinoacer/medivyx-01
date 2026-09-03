"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { Footer } from "@/components/layout/footer"
import { MobileNav } from "@/components/layout/mobile-nav"
import { CustomerHubNav } from "@/components/layout/customer-hub-nav"
import { ReferenceHomeHero } from "@/components/home/reference-home-hero"
import "./reference-home.css"
import "./reference-home-dark.css"
import "./ambient-background.css"
import "./services-showcase.css"
import "./premium-landing.css"
import "./app-experience.css"
import { setupForegroundNotificationListener } from "@/lib/firebase/client"

const ViewLoading = () => <div className="mx-auto min-h-[60vh] max-w-7xl animate-pulse px-4 py-12" aria-label="Loading"><div className="h-10 w-52 rounded-xl bg-muted" /><div className="mt-8 h-72 rounded-3xl bg-muted/70" /></div>
const HomeView = dynamic(() => import("@/components/views/home-view").then((m) => m.HomeView), { loading: ViewLoading })
const ServicesView = dynamic(() => import("@/components/views/services-view").then((m) => m.ServicesView), { loading: ViewLoading })
const CatalogView = dynamic(() => import("@/components/views/catalog-view").then((m) => m.CatalogView), { loading: ViewLoading })
const ProductView = dynamic(() => import("@/components/views/product-view").then((m) => m.ProductView), { loading: ViewLoading })
const CartView = dynamic(() => import("@/components/views/cart-view").then((m) => m.CartView), { loading: ViewLoading })
const CheckoutView = dynamic(() => import("@/components/views/checkout-view").then((m) => m.CheckoutView), { loading: ViewLoading })
const AuthView = dynamic(() => import("@/components/views/auth-view").then((m) => m.AuthView), { loading: ViewLoading })
const OrdersView = dynamic(() => import("@/components/views/orders-view").then((m) => m.OrdersView), { loading: ViewLoading })
const OrderDetailView = dynamic(() => import("@/components/views/order-detail-view").then((m) => m.OrderDetailView), { loading: ViewLoading })
const PrescriptionsView = dynamic(() => import("@/components/views/prescriptions-view").then((m) => m.PrescriptionsView), { loading: ViewLoading })
const AccountView = dynamic(() => import("@/components/views/account-view").then((m) => m.AccountView), { loading: ViewLoading })
const AdminView = dynamic(() => import("@/components/views/admin/admin-view").then((m) => m.AdminView), { loading: ViewLoading })
const AssistantWidget = dynamic(() => import("@/components/assistant/assistant-widget").then((m) => m.AssistantWidget))

export default function Page() {
  const view = useAppStore((s) => s.view)
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    refresh()
    const cleanup = setupForegroundNotificationListener()
    return () => cleanup()
  }, [refresh])

  const home = view === "home"

  return (
    <div className="ambient-page-shell flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to main content</a>
      <ReferenceHomeHero showHero={home} />
      <main id="main-content" className="flex-1 pb-28 md:pb-16" data-view={view}>
        {(["account", "orders", "order", "prescriptions"] as const).includes(view as "account" | "orders" | "order" | "prescriptions") ? (
          <CustomerHubNav />
        ) : null}
        <div className={view === "admin" ? undefined : "experience-view"}>
        {home ? <div className="reference-home-rest"><HomeView /></div> : null}
        {view === "catalog" ? <CatalogView /> : null}
        {view === "product" ? <ProductView /> : null}
        {view === "services" ? <ServicesView /> : null}
        {view === "cart" ? <CartView /> : null}
        {view === "checkout" ? <CheckoutView /> : null}
        {view === "auth" ? <AuthView /> : null}
        {view === "orders" ? <OrdersView /> : null}
        {view === "order" ? <OrderDetailView /> : null}
        {view === "prescriptions" ? <PrescriptionsView /> : null}
        {view === "account" ? <AccountView /> : null}
        {view === "admin" ? <AdminView /> : null}
        </div>
      </main>
      <Footer />
      <AssistantWidget />
      <MobileNav />
    </div>
  )
}
