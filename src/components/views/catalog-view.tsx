"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toaster } from "@/components/ui/sonner"
import { ProductCard } from "@/components/shared/product-card"
import { ProductImage } from "@/components/shared/product-image"
import { EmptyState, LoadingGrid } from "@/components/shared/empty-state"
import { LuxuryCategoryRibbon } from "@/components/catalog/luxury-category-ribbon"
import {
  HighPerformancePagination,
  type PaginationMode,
} from "@/components/catalog/high-performance-pagination"
import { useAppStore, type CatalogFilters } from "@/store/use-app-store"
import { catalogApi } from "@/lib/api-client"
import type { CategoryDTO, ProductDTO, ProductsResponse } from "@/lib/types"
import { PHARMACY, waLink } from "@/lib/constants"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Search,
  SlidersHorizontal,
  X,
  RefreshCw,
  MessageCircle,
  ChevronDown,
  LayoutGrid,
  List,
  Infinity as InfinityIcon,
  FileText,
} from "lucide-react"

const DEFAULT_PAGE_SIZE = 16

const SORT_OPTIONS: { value: CatalogFilters["sort"]; label: string }[] = [
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name A–Z" },
  { value: "newest", label: "Newest" },
]

const RX_OPTIONS: { value: CatalogFilters["rx"]; label: string }[] = [
  { value: "any", label: "All items" },
  { value: "yes", label: "Prescription only" },
  { value: "no", label: "OTC only" },
]

const AVAILABILITY_OPTIONS: { value: CatalogFilters["availability"]; label: string }[] = [
  { value: "any", label: "Any availability" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
]

// ============================== VIEW ==============================

export function CatalogView() {
  const filters = useAppStore((s) => s.catalogFilters)
  const setCatalogFilters = useAppStore((s) => s.setCatalogFilters)
  const resetCatalogFilters = useAppStore((s) => s.resetCatalogFilters)

  // local search input override (null = show the committed filters.search)
  const [override, setOverride] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const effectiveSearch = override ?? filters.search

  // View presentation mode: "grid" vs "list"
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid")

  // Pagination mode: "infinite" vs "pages"
  const [paginationMode, setPaginationMode] = useState<PaginationMode>("infinite")

  // Page state for numbered pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)

  // ---------- categories ----------
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    catalogApi
      .categories()
      .then((cats) => {
        if (!cancelled) setCategories(cats)
      })
      .catch(() => {
        if (!cancelled) setCategoriesError("Couldn't load categories")
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ---------- debounced search: push local typing into the store filters ----------
  useEffect(() => {
    if (override === null || override === filters.search) return
    const t = setTimeout(() => {
      setCatalogFilters({ search: override })
      setOverride(null)
      setCurrentPage(1) // reset page on new search
    }, 350)
    return () => clearTimeout(t)
  }, [override, filters.search, setCatalogFilters])

  // ---------- products loading ----------
  const [items, setItems] = useState<ProductDTO[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters.category, filters.rx, filters.availability, filters.sort, filters.search])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res: ProductsResponse = await catalogApi.products({
          search: filters.search || undefined,
          category: filters.category || undefined,
          rx: filters.rx === "any" ? undefined : filters.rx,
          availability: filters.availability === "any" ? undefined : filters.availability,
          sort: filters.sort,
          page: currentPage,
          pageSize,
        })
        if (cancelled) return
        setTotal(res.total)
        setItems(res.items)
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Couldn't load products")
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [filters, reloadNonce, currentPage, pageSize])

  // Load more for Infinite Scroll mode
  async function loadMore() {
    if (moreLoading || loading || items.length >= total) return
    setMoreLoading(true)
    try {
      const nextPage = Math.floor(items.length / pageSize) + 1
      const res: ProductsResponse = await catalogApi.products({
        search: filters.search || undefined,
        category: filters.category || undefined,
        rx: filters.rx === "any" ? undefined : filters.rx,
        availability: filters.availability === "any" ? undefined : filters.availability,
        sort: filters.sort,
        page: nextPage,
        pageSize,
      })
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id))
        return [...prev, ...res.items.filter((p) => !seen.has(p.id))]
      })
      setTotal(res.total)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Couldn't load more products — try again.")
    } finally {
      setMoreLoading(false)
    }
  }

  function handlePageChange(newPage: number) {
    setCurrentPage(newPage)
    window.scrollTo({ top: 120, behavior: "smooth" })
  }

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize)
    setCurrentPage(1)
    window.scrollTo({ top: 120, behavior: "smooth" })
  }

  const activeCategory = categories?.find((c) => c.id === filters.category) ?? null
  const hasActiveFilters =
    !!filters.search || !!filters.category || filters.rx !== "any" || filters.availability !== "any"
  const loadingFirstPage = loading
  const hasMore = items.length < total && !error

  function clearAll() {
    resetCatalogFilters()
    setOverride(null)
    setSheetOpen(false)
    setCurrentPage(1)
  }

  function pickCategory(id: string | null) {
    setCatalogFilters({ category: id ?? "" })
    setSheetOpen(false)
    setCurrentPage(1)
  }

  // ---------- filter panel (shared by sidebar & mobile sheet) ----------
  const filterPanel = (
    <div className="space-y-6">
      {/* categories */}
      <div>
        <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <ChevronDown className="h-3.5 w-3.5 -rotate-90" aria-hidden /> Categories
        </h3>
        {categoriesError ? (
          <p className="text-xs text-muted-foreground">{categoriesError} — filters still work.</p>
        ) : !categories ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <ul className="scroll-slim max-h-72 space-y-1 overflow-y-auto pr-1">
            <li>
              <button
                onClick={() => pickCategory(null)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  !filters.category ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent/60"
                )}
              >
                All products
                <span className="text-xs text-muted-foreground">{total > 0 ? total : ""}</span>
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => pickCategory(c.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    filters.category === c.id ? "bg-primary/10 font-semibold text-primary" : "hover:bg-accent/60"
                  )}
                  aria-pressed={filters.category === c.id}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ProductImage
                      src={c.icon}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-md border bg-muted"
                      fallback="/images/cat-fallback.webp"
                    />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.productCount}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      {/* rx filter */}
      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Prescription</h3>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Prescription filter">
          {RX_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={filters.rx === opt.value}
              onClick={() => setCatalogFilters({ rx: opt.value })}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                filters.rx === opt.value ? "bg-background shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* availability */}
      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Availability</h3>
        <Select
          value={filters.availability}
          onValueChange={(v) => setCatalogFilters({ availability: v as CatalogFilters["availability"] })}
        >
          <SelectTrigger className="w-full" aria-label="Filter by availability">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AVAILABILITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* sort */}
      <div>
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Sort by</h3>
        <Select value={filters.sort} onValueChange={(v) => setCatalogFilters({ sort: v as CatalogFilters["sort"] })}>
          <SelectTrigger className="w-full" aria-label="Sort products">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <Button variant="outline" className="w-full gap-1.5" onClick={clearAll}>
          <X className="h-4 w-4" /> Clear all filters
        </Button>
      ) : null}
    </div>
  )

  return (
    <div className="pb-12">
      <Toaster position="bottom-left" richColors closeButton />

      {/* page heading banner */}
      <div className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:pt-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                Sphere Dispensary
              </span>
              <span className="text-xs text-muted-foreground">Lumumba Drive, Roysambu</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl text-foreground">
              {activeCategory ? activeCategory.name : "Pharmaceutical & Wellness Catalog"}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {activeCategory?.description ??
                "Browse clinical medicines, vitamins, diagnostic devices and health essentials with live stock status."}
            </p>
          </div>
        </div>

        {/* Luxury Category Ribbon for 1-click filtering */}
        <div className="mt-5 border-t border-b border-border/40 py-1">
          <LuxuryCategoryRibbon
            categories={categories}
            activeCategoryId={filters.category}
            totalProductCount={total}
            onSelectCategory={pickCategory}
          />
        </div>
      </div>

      {/* mobile sticky search + filter bar */}
      <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={effectiveSearch}
              onChange={(e) => setOverride(e.target.value)}
              placeholder="Search products…"
              className="h-10 rounded-full bg-muted/50 pl-9 pr-8 text-sm"
              aria-label="Search products"
              enterKeyHint="search"
            />
            {effectiveSearch ? (
              <button
                onClick={() => { setOverride(null); setCatalogFilters({ search: "" }) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 shrink-0 gap-1.5 rounded-full px-4 text-xs font-semibold">
                <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
                {hasActiveFilters ? <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1 text-[11px] font-bold">!</Badge> : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle className="text-base">Filters & sorting</SheetTitle>
                <SheetDescription className="sr-only">Narrow down the product catalogue</SheetDescription>
              </SheetHeader>
              <div className="p-4">{filterPanel}</div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* desktop search bar */}
      <div className="mx-auto hidden max-w-7xl px-4 pb-4 pt-4 lg:block">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={effectiveSearch}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="Search medicines, active ingredients, brands, vitamins…"
            className="h-11 rounded-full bg-muted/50 pl-10 pr-9 text-sm"
            aria-label="Search products"
            enterKeyHint="search"
          />
          {effectiveSearch ? (
            <button
              onClick={() => { setOverride(null); setCatalogFilters({ search: "" }) }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 pt-2">
        {/* sidebar (desktop) */}
        <aside className="hidden w-64 shrink-0 lg:block" aria-label="Product filters">
          <Card className="sticky top-36 rounded-2xl border-border/70 shadow-sm">
            <CardContent className="p-5">{filterPanel}</CardContent>
          </Card>
        </aside>

        {/* results section */}
        <section className="min-w-0 flex-1" aria-live="polite">
          {/* Results controls header bar: Chips + View Switcher + Pagination Mode */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/60 p-3 backdrop-blur-sm">
            {/* active filter chips */}
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              {loadingFirstPage ? (
                <Skeleton className="h-6 w-28" />
              ) : (
                <p className="text-xs font-semibold text-muted-foreground pr-1" role="status">
                  <span className="font-bold text-foreground">{total}</span> product{total === 1 ? "" : "s"}
                </p>
              )}
              {filters.search ? (
                <FilterChip label={`“${filters.search}”`} onRemove={() => { setCatalogFilters({ search: "" }); setOverride(null) }} />
              ) : null}
              {activeCategory ? <FilterChip label={activeCategory.name} onRemove={() => pickCategory(null)} /> : null}
              {filters.rx !== "any" ? (
                <FilterChip label={filters.rx === "yes" ? "Prescription (Rx)" : "OTC Only"} onRemove={() => setCatalogFilters({ rx: "any" })} />
              ) : null}
              {filters.availability !== "any" ? (
                <FilterChip
                  label={AVAILABILITY_OPTIONS.find((o) => o.value === filters.availability)?.label ?? filters.availability}
                  onRemove={() => setCatalogFilters({ availability: "any" })}
                />
              ) : null}
            </div>

            {/* Layout Mode & Pagination Mode Switchers */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              {/* Pagination mode: Auto Scroll vs Pages */}
              <div className="flex items-center rounded-xl border border-border/70 bg-muted/60 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPaginationMode("infinite")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all",
                    paginationMode === "infinite"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Seamless auto-scrolling feed"
                >
                  <InfinityIcon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Infinite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaginationMode("pages")}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all",
                    paginationMode === "pages"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Numbered page navigation"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Pages</span>
                </button>
              </div>

              {/* Layout mode: Grid vs List */}
              <div className="flex items-center rounded-xl border border-border/70 bg-muted/60 p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setLayoutMode("grid")}
                  className={cn(
                    "rounded-lg p-1.5 transition-all",
                    layoutMode === "grid"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("list")}
                  className={cn(
                    "rounded-lg p-1.5 transition-all",
                    layoutMode === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Grid / List Results */}
          {error && items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReloadNonce((n) => n + 1)}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          ) : loadingFirstPage ? (
            <LoadingGrid count={12} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No products match your filters"
              description="Try a different search term, clear some filters, or ask us directly on WhatsApp — we may have it in stock behind the counter."
              action={{ label: "Clear all filters", onClick: clearAll }}
            />
          ) : (
            <>
              {/* Product Cards: Grid Layout */}
              {layoutMode === "grid" ? (
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map((p, idx) => {
                    const isTopPriority = filters.sort === "popular" && currentPage === 1 && idx < 3
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        priorityRank={isTopPriority ? idx + 1 : undefined}
                      />
                    )
                  })}
                </div>
              ) : (
                /* Product Cards: Apothecary List Layout */
                <div className="space-y-3">
                  {items.map((p, idx) => {
                    const isTopPriority = filters.sort === "popular" && currentPage === 1 && idx < 3
                    return (
                      <ProductCard
                        key={p.id}
                        product={p}
                        layout="compact-row"
                        priorityRank={isTopPriority ? idx + 1 : undefined}
                      />
                    )
                  })}
                </div>
              )}

              {/* High Performance Pagination & Infinite Scroll */}
              <HighPerformancePagination
                mode={paginationMode}
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={total}
                loadedCount={items.length}
                hasMore={hasMore}
                isLoadingMore={moreLoading}
                onLoadMore={loadMore}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </>
          )}

          {/* WhatsApp fallback when empty */}
          {items.length === 0 && !loadingFirstPage ? (
            <div className="mt-4 flex justify-center">
              <a
                href={waLink(`Hi ${PHARMACY.name}, I'm looking for a product I can't find on your website.`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" className="gap-1.5 bg-emerald-700 text-white hover:bg-emerald-800">
                  <MessageCircle className="h-4 w-4" /> Ask on WhatsApp
                </Button>
              </a>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/70 py-1 pl-3 pr-1.5 text-xs font-semibold text-foreground">
      <span className="truncate">{label}</span>
      <button onClick={onRemove} className="rounded-full p-0.5 hover:bg-background text-muted-foreground hover:text-foreground" aria-label={`Remove filter ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
