"use client"

import { useMemo, useState } from "react"
import { ProductCard } from "@/components/shared/product-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppStore } from "@/store/use-app-store"
import type { ProductDTO, ProductsResponse } from "@/lib/types"
import { waLink, PHARMACY } from "@/lib/constants"
import { ArrowRight, Sparkles, RefreshCw, MessageCircle, ShieldCheck, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

interface PriorityProductsSectionProps {
  data: ProductsResponse | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

type PriorityTab = "all" | "rx" | "otc" | "vitamins"

export function PriorityProductsSection({
  data,
  loading,
  error,
  onRetry,
}: PriorityProductsSectionProps) {
  const navigate = useAppStore((s) => s.navigate)
  const resetCatalogFilters = useAppStore((s) => s.resetCatalogFilters)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)

  const [activeTab, setActiveTab] = useState<PriorityTab>("all")

  const allItems = useMemo(() => data?.items ?? [], [data])

  // Filter items based on selected priority tab
  const filteredItems = useMemo(() => {
    if (!allItems.length) return []
    if (activeTab === "all") return allItems
    if (activeTab === "rx") return allItems.filter((p) => p.requiresPrescription)
    if (activeTab === "otc") return allItems.filter((p) => !p.requiresPrescription)
    if (activeTab === "vitamins") {
      return allItems.filter(
        (p) =>
          p.categorySlug === "vitamins" ||
          p.name.toLowerCase().includes("vitamin") ||
          p.name.toLowerCase().includes("supplement") ||
          p.name.toLowerCase().includes("zinc")
      )
    }
    return allItems
  }, [allItems, activeTab])

  const topSpotlightItem = filteredItems[0] ?? null
  const secondaryItems = filteredItems.slice(1, 7)

  function browseAll() {
    resetCatalogFilters()
    navigate("catalog")
  }

  function browseRx() {
    setCatalogFilters({ rx: "yes" })
    navigate("catalog")
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-80 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || allItems.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {error ? "Couldn't load priority products right now." : "No products to show yet."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {error ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          ) : null}
          <a
            href={waLink("Hi, I'd like to ask about available priority products.")}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" size="sm" className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800">
              <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
            </Button>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Priority curation filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all",
              activeTab === "all"
                ? "bg-foreground text-background shadow-sm"
                : "border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            Top Community Picks
          </button>

          <button
            onClick={() => setActiveTab("rx")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all",
              activeTab === "rx"
                ? "bg-emerald-700 text-white shadow-sm"
                : "border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Prescription Care (℞)
          </button>

          <button
            onClick={() => setActiveTab("otc")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all",
              activeTab === "otc"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Everyday Health & OTC
          </button>

          <button
            onClick={() => setActiveTab("vitamins")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all",
              activeTab === "vitamins"
                ? "bg-amber-600 text-white shadow-sm"
                : "border border-border/80 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            🌿 Daily Vitamins
          </button>
        </div>

        <span className="text-xs text-muted-foreground font-medium">
          Showing {filteredItems.length} curated {activeTab === "all" ? "essentials" : activeTab}
        </span>
      </div>

      {/* Creative Editorial Bento: Spotlight Hero on Left / Top + Ranked Grid */}
      <div className="space-y-6">
        {/* Spotlight Hero for #1 Priority */}
        {topSpotlightItem ? (
          <ProductCard
            product={topSpotlightItem}
            layout="spotlight"
            priorityRank={1}
            priorityTag={
              activeTab === "rx"
                ? "Flagship ℞ Essential"
                : activeTab === "vitamins"
                ? "Top Vitality Pick"
                : "Roysambu #1 Favorite"
            }
          />
        ) : null}

        {/* Secondary Priority Items Grid with Editorial Badging */}
        {secondaryItems.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Priority Tiers · Community Verified
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {secondaryItems.map((p, idx) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  priorityRank={idx + 2}
                  priorityTag={
                    p.compareAtPrice
                      ? "Special Value"
                      : p.requiresPrescription
                      ? "Doctor Verified"
                      : "Staff Choice"
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Luxury Footer Action */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
        <div className="space-y-0.5 text-center sm:text-left">
          <h4 className="text-sm font-bold text-foreground">
            Looking for a specific brand, dosage or compound?
          </h4>
          <p className="text-xs text-muted-foreground">
            Our dispensary carries hundreds of verified pharmaceuticals and surgical supplies.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" onClick={browseRx}>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> All ℞ Medicines
          </Button>
          <Button size="sm" className="btn-sheen rounded-xl text-xs gap-1.5 font-semibold" onClick={browseAll}>
            Browse full catalog <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
