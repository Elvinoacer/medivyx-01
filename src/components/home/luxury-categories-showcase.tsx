"use client"

import { useMemo, useState } from "react"
import { ProductImage } from "@/components/shared/product-image"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAppStore } from "@/store/use-app-store"
import type { CategoryDTO } from "@/lib/types"
import { ArrowRight, Sparkles, ShieldCheck, HeartPulse, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface LuxuryCategoriesShowcaseProps {
  categories: CategoryDTO[] | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

// Visual theme configurations for key categories to give an apothecary editorial feel
const CATEGORY_STYLING: Record<
  string,
  {
    themeGradient: string
    badgeText: string
    accentColor: string
    description: string
  }
> = {
  prescription: {
    themeGradient: "from-emerald-950/80 via-teal-900/60 to-emerald-900/80",
    badgeText: "Pharmacist ℞ Verified",
    accentColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/15",
    description: "Doctor-prescribed medicines dispensed with care and strict verification.",
  },
  vitamins: {
    themeGradient: "from-amber-950/80 via-yellow-950/50 to-orange-950/70",
    badgeText: "Immunity & Longevity",
    accentColor: "text-amber-300 border-amber-500/30 bg-amber-500/15",
    description: "Bioactive supplements, minerals, and daily vitality boosters.",
  },
  "pain-fever": {
    themeGradient: "from-cyan-950/80 via-sky-950/60 to-blue-950/70",
    badgeText: "Rapid Clinical Relief",
    accentColor: "text-cyan-300 border-cyan-500/30 bg-cyan-500/15",
    description: "Effective antipyretics and analgesics for acute and muscular pain.",
  },
  "mother-baby": {
    themeGradient: "from-rose-950/80 via-pink-950/50 to-rose-900/70",
    badgeText: "Gentle Pediatric Care",
    accentColor: "text-rose-300 border-rose-500/30 bg-rose-500/15",
    description: "Dermatologist-tested formulas for mothers, infants, and toddlers.",
  },
  "skin-care": {
    themeGradient: "from-fuchsia-950/80 via-purple-950/50 to-pink-950/70",
    badgeText: "Dermatological Care",
    accentColor: "text-fuchsia-300 border-fuchsia-500/30 bg-fuchsia-500/15",
    description: "Targeted barrier repair, gentle cleansers, and medical moisturizers.",
  },
}

export function LuxuryCategoriesShowcase({
  categories,
  loading,
  error,
  onRetry,
}: LuxuryCategoriesShowcaseProps) {
  const navigate = useAppStore((s) => s.navigate)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const resetCatalogFilters = useAppStore((s) => s.resetCatalogFilters)

  const [activeTab, setActiveTab] = useState<string>("all")

  function shopCategory(c: CategoryDTO) {
    setCatalogFilters({ category: c.id, search: "" })
    navigate("catalog")
  }

  function browseAll() {
    resetCatalogFilters()
    navigate("catalog")
  }

  // Partition into hero bento categories (top 3) and companion categories
  const { heroCategories, companionCategories } = useMemo(() => {
    if (!categories || categories.length === 0) {
      return { heroCategories: [], companionCategories: [] }
    }

    // Try to pick prescription, vitamins, and pain-fever or first 3
    const preferredHeroSlugs = ["prescription", "vitamins", "pain-fever"]
    const heroes: CategoryDTO[] = []
    const companions: CategoryDTO[] = []

    categories.forEach((cat) => {
      if (preferredHeroSlugs.includes(cat.slug) && heroes.length < 3) {
        heroes.push(cat)
      } else {
        companions.push(cat)
      }
    })

    // If we didn't find the preferred ones, just split
    if (heroes.length < 2) {
      return {
        heroCategories: categories.slice(0, 2),
        companionCategories: categories.slice(2),
      }
    }

    return { heroCategories: heroes, companionCategories: companions }
  }, [categories])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-12">
          <Skeleton className="h-64 rounded-3xl md:col-span-7" />
          <Skeleton className="h-64 rounded-3xl md:col-span-5" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !categories || categories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Couldn't load categories. Check your connection and try again."}
        </p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Quick category filter ribbon */}
      <div className="scroll-slim flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => {
            setActiveTab("all")
            browseAll()
          }}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all",
            activeTab === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "border border-border/80 bg-card hover:bg-muted text-foreground"
          )}
        >
          All Departments
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setActiveTab(c.id)
              shopCategory(c)
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all hover:scale-[1.02]",
              activeTab === c.id
                ? "border-primary bg-primary/10 text-primary shadow-sm"
                : "border-border/70 bg-card/80 text-foreground/80 hover:border-primary/40 hover:text-foreground"
            )}
          >
            <ProductImage
              src={c.icon}
              alt=""
              className="h-4 w-4 rounded-full"
              fallback="/images/cat-fallback.webp"
            />
            <span>{c.name}</span>
            <span className="text-[10px] text-muted-foreground">({c.productCount})</span>
          </button>
        ))}
      </div>

      {/* Hero Bento Showcase Cards */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-12">
        {heroCategories.map((c, index) => {
          const style = CATEGORY_STYLING[c.slug] ?? {
            themeGradient: "from-emerald-950/80 via-teal-900/60 to-emerald-900/80",
            badgeText: "Verified Pharmacy Essential",
            accentColor: "text-emerald-400 border-emerald-500/30 bg-emerald-500/15",
            description: c.description ?? "Curated pharmaceutical wellness products.",
          }

          const isWide = index === 0

          return (
            <article
              key={c.id}
              onClick={() => shopCategory(c)}
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-3xl border border-white/10 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.3)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_24px_50px_-15px_rgba(16,117,47,0.25)]",
                isWide ? "md:col-span-7" : "md:col-span-5"
              )}
            >
              {/* background image */}
              <div className="absolute inset-0 z-0">
                <ProductImage
                  src={c.icon}
                  alt={c.name}
                  className="h-full w-full"
                  imgClassName="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
                  fallback="/images/cat-fallback.webp"
                />
                {/* ambient dark overlay */}
                <div
                  className={cn(
                    "absolute inset-0 bg-gradient-to-t via-black/60 to-black/30 backdrop-blur-[1px]",
                    style.themeGradient
                  )}
                />
              </div>

              {/* content */}
              <div className="relative z-10 flex h-full min-h-[260px] sm:min-h-[290px] flex-col justify-between p-6 text-white sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md",
                      style.accentColor
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    {style.badgeText}
                  </span>
                  <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold backdrop-blur-md">
                    {c.productCount} in stock
                  </span>
                </div>

                <div className="mt-8 space-y-2">
                  <h3 className="text-2xl font-black tracking-tight sm:text-3xl text-white group-hover:text-emerald-300 transition-colors">
                    {c.name}
                  </h3>
                  <p className="line-clamp-2 text-sm text-white/80 max-w-md">
                    {style.description}
                  </p>

                  <div className="pt-3">
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300 group-hover:gap-3 transition-all">
                      Browse Collection <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      {/* Companion Categories Grid (Creative Tiles) */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Explore All Health & Care Aisles
          </p>
          <button
            onClick={browseAll}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            All aisles <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {companionCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => shopCategory(c)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-3.5 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md hover:bg-card"
              aria-label={`Shop ${c.name}, ${c.productCount} products`}
            >
              {/* top photo pill */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted/60 p-2 mb-3">
                <ProductImage
                  src={c.icon}
                  alt={c.name}
                  className="h-full w-full"
                  imgClassName="transition-transform duration-500 ease-out group-hover:scale-110"
                  fallback="/images/cat-fallback.webp"
                />
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-bold text-foreground shadow-sm backdrop-blur-sm">
                  {c.productCount}
                </span>
              </div>

              {/* labels */}
              <div className="space-y-1">
                <h4 className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {c.name}
                </h4>
                <p className="line-clamp-1 text-[11px] text-muted-foreground">
                  {c.description || "Healthcare essential"}
                </p>
              </div>

              <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                <span className="font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">
                  Shop aisle
                </span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
