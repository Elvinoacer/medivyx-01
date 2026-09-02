"use client"

import { useEffect } from "react"
import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { MobileNav } from "@/components/layout/mobile-nav"
import { AssistantWidget } from "@/components/assistant/assistant-widget"
import { ReferenceHomeHero } from "@/components/home/reference-home-hero"
import "./reference-home.css"
import { HomeView } from "@/components/views/home-view"
import { CatalogView } from "@/components/views/catalog-view"
import { ProductView } from "@/components/views/product-view"
import { CartView } from "@/components/views/cart-view"
import { CheckoutView } from "@/components/views/checkout-view"
import { AuthView } from "@/components/views/auth-view"
import { OrdersView } from "@/components/views/orders-view"
import { OrderDetailView } from "@/components/views/order-detail-view"
import { PrescriptionsView } from "@/components/views/prescriptions-view"
import { AccountView } from "@/components/views/account-view"
import { AdminView } from "@/components/views/admin/admin-view"

export default function Page() {
  const view = useAppStore((s) => s.view)
  const refresh = useAuthStore((s) => s.refresh)

  useEffect(() => {
    refresh()
  }, [refresh])

  const home = view === "home"

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      {home ? <ReferenceHomeHero /> : <Header />}
      <main id="main-content" className="flex-1 pb-28 md:pb-16">
        {view === "home" ? <div className="reference-home-rest"><HomeView /></div> : null}
        {view === "catalog" ? <CatalogView /> : null}
        {view === "product" ? <ProductView /> : null}
        {view === "cart" ? <CartView /> : null}
        {view === "checkout" ? <CheckoutView /> : null}
        {view === "auth" ? <AuthView /> : null}
        {view === "orders" ? <OrdersView /> : null}
        {view === "order" ? <OrderDetailView /> : null}
        {view === "prescriptions" ? <PrescriptionsView /> : null}
        {view === "account" ? <AccountView /> : null}
        {view === "admin" ? <AdminView /> : null}
      </main>
      <Footer />
      <AssistantWidget />
      <MobileNav />
    </div>
  )
}
