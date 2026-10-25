"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { Footer } from "@/components/layout/footer"
import { MobileNav } from "@/components/layout/mobile-nav"
import { CustomerHubNav } from "@/components/layout/customer-hub-nav"
import { SphereLanding } from "@/components/home/sphere-landing"
import { SphereHeader } from "@/components/layout/sphere-header"
import "./reference-home.css"
import "./reference-home-dark.css"
import "./ambient-background.css"
import "./services-showcase.css"
import "./premium-landing.css"
import "./app-experience.css"
import "./sphere-public.css"
import "./admin-workspace.css"
import { setupForegroundNotificationListener, enablePushNotifications, getPushPermissionState } from "@/lib/firebase/client"

const ViewLoading = () => <div className="mx-auto min-h-[60vh] max-w-7xl animate-pulse px-4 py-12" aria-label="Loading"><div className="h-10 w-52 rounded-xl bg-muted" /><div className="mt-8 h-72 rounded-3xl bg-muted/70" /></div>
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
  const hydrateFromLocation = useAppStore((s) => s.hydrateFromLocation)
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    hydrateFromLocation()
    window.addEventListener("popstate", hydrateFromLocation)
    refresh()
    const cleanup = setupForegroundNotificationListener()
    return () => { cleanup(); window.removeEventListener("popstate", hydrateFromLocation) }
  }, [hydrateFromLocation, refresh])

  const session = useAuthStore((s) => s.session)
  useEffect(() => {
    if (session && getPushPermissionState() === "granted" && localStorage.getItem("sphere_device_token")) {
      void enablePushNotifications()
    }
  }, [session])

  const params = useAppStore((s) => s.params)
  const home = view === "home"
  const authMode = useAppStore((s) => s.authMode)
  const admin = view === "admin" || (view === "auth" && authMode === "staff")

  return (
    <div className={`ambient-page-shell flex min-h-screen flex-col ${admin ? "admin-experience" : "sphere-public"}`}>
      <a href="#main-content" className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to main content</a>
      {!home && !admin ? <SphereHeader /> : null}
      <main id="main-content" className={home || admin ? "flex-1" : "flex-1 pb-28 md:pb-16"} data-view={view}>
        {(["account", "orders", "order", "prescriptions"] as const).includes(view as "account" | "orders" | "order" | "prescriptions") || (view === "services" && params.tab === "bookings") ? (
          <CustomerHubNav />
        ) : null}
        <div className={admin || home ? undefined : "experience-view"}>
        {home ? <SphereLanding /> : null}
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
      {!home && !admin ? <Footer /> : null}
      {!admin ? <AssistantWidget /> : null}
      {!admin ? <MobileNav /> : null}
    </div>
  )
}
