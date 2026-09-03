"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RxFlagBadge } from "@/components/shared/status-badges"
import { ProductImage } from "@/components/shared/product-image"
import { formatKES } from "@/lib/format"
import type { ProductDTO } from "@/lib/types"
import { useCartStore } from "@/store/use-cart-store"
import { useWishStore } from "@/store/use-wish-store"
import { useAppStore } from "@/store/use-app-store"
import { toast } from "sonner"
import {
  Plus,
  ShoppingCart,
  Heart,
  Star,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface ProductCardProps {
  product: ProductDTO
  priorityRank?: number
  priorityTag?: string
  layout?: "grid" | "spotlight" | "compact-row"
  showQuickAdd?: boolean
  className?: string
}

export function StarRow({
  value,
  count,
  size = 3.5,
  showNumeric = false,
}: {
  value: number
  count?: number
  size?: number
  showNumeric?: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`Rated ${value.toFixed(1)} out of 5${count != null ? ` by ${count} customers` : ""}`}
    >
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            style={{ width: size * 4, height: size * 4 }}
            className={cn(
              "shrink-0",
              i <= Math.round(value)
                ? "fill-amber-400 text-amber-400"
                : "fill-muted/70 text-muted/70"
            )}
            aria-hidden
          />
        ))}
      </span>
      {showNumeric ? (
        <span className="text-xs font-semibold text-foreground/90">{value.toFixed(1)}</span>
      ) : null}
      {count != null ? (
        <span className="text-[11px] text-muted-foreground">({count})</span>
      ) : null}
    </span>
  )
}

export function ProductCard({
  product,
  priorityRank,
  priorityTag,
  layout = "grid",
  showQuickAdd = true,
  className,
}: ProductCardProps) {
  const navigate = useAppStore((s) => s.navigate)
  const add = useCartStore((s) => s.add)
  const wishToggle = useWishStore((s) => s.toggle)
  const wishHas = useWishStore((s) => s.has(product.id))
  const outOfStock =
    product.stockStatus === "OUT_OF_STOCK" || product.stockStatus === "DISCONTINUED"
  const isLowStock = product.stockStatus === "LOW_STOCK"

  function handleAdd(e?: React.MouseEvent) {
    e?.stopPropagation()
    if (outOfStock) return
    add({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      requiresPrescription: product.requiresPrescription,
      packSize: product.packSize,
      stockStatus: product.stockStatus,
    })
    toast.success(
      product.requiresPrescription
        ? `${product.name} added — prescription review required at checkout`
        : `${product.name} added to cart`,
      { action: { label: "View cart", onClick: () => navigate("cart") } }
    )
  }

  function handleWish(e: React.MouseEvent) {
    e.stopPropagation()
    const saved = wishToggle({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      requiresPrescription: product.requiresPrescription,
      packSize: product.packSize,
      brand: product.brand,
    })
    toast.success(
      saved ? `${product.name} saved to your list` : `Removed ${product.name} from saved items`
    )
  }

  // =================== SPOTLIGHT / EDITORIAL HERO LAYOUT ===================
  if (layout === "spotlight") {
    return (
      <article
        onClick={() => navigate("product", { productId: product.id })}
        className={cn(
          "group relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-card via-card/95 to-emerald-950/[0.04] p-5 shadow-[0_20px_50px_-20px_rgba(16,117,47,0.18)] transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[0_24px_60px_-15px_rgba(16,117,47,0.24)] sm:p-7 md:p-8 dark:from-card dark:via-card/90 dark:to-emerald-950/20 dark:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] cursor-pointer",
          className
        )}
      >
        {/* ambient glow in background */}
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />

        <div className="relative grid items-center gap-6 sm:grid-cols-12 sm:gap-8">
          {/* visual column */}
          <div className="sm:col-span-5 md:col-span-5">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50/50 via-muted/40 to-teal-50/30 p-4 dark:from-emerald-950/30 dark:via-muted/20 dark:to-teal-950/20">
              {/* rank pill */}
              <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                <Sparkles className="h-3.5 w-3.5" />
                {priorityRank ? `#${String(priorityRank).padStart(2, "0")}` : "Top"} {priorityTag ?? "Community Choice"}
              </div>

              {/* savings pill */}
              {product.compareAtPrice ? (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm">
                  Save {formatKES(product.compareAtPrice - product.price)}
                </span>
              ) : null}

              <ProductImage
                src={product.image}
                alt={product.name}
                className="h-full w-full"
                imgClassName="transition-transform duration-500 ease-out group-hover:scale-105"
              />

              {/* wishlist button */}
              <button
                onClick={handleWish}
                aria-label={wishHas ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
                aria-pressed={wishHas}
                className={cn(
                  "absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border shadow-md backdrop-blur-md transition-transform duration-200 hover:scale-110 active:scale-95",
                  wishHas
                    ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                    : "border-border/70 bg-card/90 text-muted-foreground hover:text-rose-600 shadow-sm"
                )}
              >
                <Heart className={cn("h-4 w-4", wishHas && "fill-rose-500 text-rose-500")} />
              </button>
            </div>
          </div>

          {/* details column */}
          <div className="flex flex-col justify-between space-y-4 sm:col-span-7 md:col-span-7">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {product.brand || "Sphere Pharmacy"}
                </span>
                {product.packSize ? (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {product.packSize}
                  </span>
                ) : null}
                {product.requiresPrescription ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300">
                    <ShieldCheck className="h-3 w-3" /> ℞ Doctor Prescribed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <Zap className="h-3 w-3" /> OTC Available
                  </span>
                )}
              </div>

              <h3 className="mt-2 text-xl font-extrabold tracking-tight text-foreground sm:text-2xl group-hover:text-primary transition-colors">
                {product.name}
              </h3>

              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground sm:line-clamp-3">
                {product.description || "Authentic healthcare and wellness formula dispensed directly from Sphere Pharmacy Roysambu."}
              </p>

              {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
                <div className="mt-3">
                  <StarRow value={product.avgRating} count={product.reviewCount} size={4} showNumeric />
                </div>
              ) : null}
            </div>

            <div className="pt-2 border-t border-border/50">
              <div className="flex flex-wrap items-baseline gap-3 mb-4">
                <span className="tnum text-2xl font-black text-foreground sm:text-3xl">
                  {formatKES(product.price)}
                </span>
                {product.compareAtPrice ? (
                  <span className="tnum text-sm text-muted-foreground line-through">
                    {formatKES(product.compareAtPrice)}
                  </span>
                ) : null}
                {isLowStock ? (
                  <span className="ml-auto rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    Low stock — only {product.stockQty} left
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  size="lg"
                  className="btn-sheen flex-1 h-12 gap-2 rounded-xl text-sm font-bold shadow-md"
                  disabled={outOfStock}
                  onClick={handleAdd}
                >
                  {outOfStock ? (
                    "Temporarily Unavailable"
                  ) : product.requiresPrescription ? (
                    <>
                      <ShoppingCart className="h-4 w-4" /> Add · ℞ Review at Checkout
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Add to cart
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl px-4 text-xs font-semibold gap-1.5"
                  onClick={() => navigate("product", { productId: product.id })}
                >
                  Details <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </article>
    )
  }

  // =================== COMPACT ROW / APOTHECARY LIST LAYOUT ===================
  if (layout === "compact-row") {
    return (
      <article
        onClick={() => navigate("product", { productId: product.id })}
        className={cn(
          "group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/90 p-3.5 sm:p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-md cursor-pointer",
          outOfStock && "opacity-80",
          className
        )}
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          {/* thumbnail */}
          <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-muted p-1">
            <ProductImage
              src={product.image}
              alt={product.name}
              className="h-full w-full"
              imgClassName="transition-transform duration-300 group-hover:scale-105"
            />
            {priorityRank ? (
              <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1 py-0.5 text-[9px] font-bold text-background">
                #{priorityRank}
              </span>
            ) : null}
          </div>

          {/* info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {product.brand || "Sphere"}
              </span>
              {product.packSize ? (
                <span className="text-xs text-muted-foreground/80">· {product.packSize}</span>
              ) : null}
              {product.requiresPrescription ? (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                  ℞
                </span>
              ) : null}
            </div>

            <h4 className="line-clamp-1 text-sm font-bold text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h4>

            <p className="line-clamp-1 text-xs text-muted-foreground hidden sm:block">
              {product.description}
            </p>

            {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <StarRow value={product.avgRating} count={product.reviewCount} size={3} />
              </div>
            ) : null}
          </div>
        </div>

        {/* price & actions */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          <div className="text-left sm:text-right">
            <div className="tnum text-base font-extrabold text-foreground">
              {formatKES(product.price)}
            </div>
            {product.compareAtPrice ? (
              <div className="tnum text-xs text-muted-foreground line-through">
                {formatKES(product.compareAtPrice)}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleWish}
              aria-label={wishHas ? `Remove ${product.name}` : `Save ${product.name}`}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                wishHas
                  ? "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                  : "border-border/60 bg-background text-muted-foreground hover:text-rose-600"
              )}
            >
              <Heart className={cn("h-4 w-4", wishHas && "fill-rose-500 text-rose-500")} />
            </button>

            {showQuickAdd ? (
              <Button
                size="sm"
                className="btn-sheen h-9 rounded-xl px-3 sm:px-4 text-xs font-semibold gap-1.5"
                disabled={outOfStock}
                onClick={handleAdd}
              >
                {outOfStock ? (
                  "Unavailable"
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  // =================== DEFAULT LUXURY GRID CARD ===================
  return (
    <Card
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/40 hover:shadow-[0_16px_36px_-10px_rgba(16,117,47,0.16)] dark:bg-card/75 dark:shadow-none dark:hover:border-emerald-400/40 dark:hover:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.5)]",
        className
      )}
      onClick={() => navigate("product", { productId: product.id })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || (e.key === " " && !e.repeat)) {
          e.preventDefault()
          navigate("product", { productId: product.id })
        }
      }}
      aria-label={`View ${product.name}`}
    >
      <CardContent className="p-0 flex flex-col h-full">
        {/* visual frame */}
        <div className={cn("relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-b from-muted/60 via-muted/30 to-background p-3", outOfStock && "grayscale")}>
          <ProductImage
            src={product.image}
            alt={`${product.name}${product.packSize ? ` — ${product.packSize}` : ""}`}
            className="h-full w-full"
            imgClassName="transition-transform duration-500 ease-out group-hover:scale-106"
          />

          {/* luxury rank / priority tag badge */}
          {priorityRank != null ? (
            <div className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1 rounded-full bg-emerald-700/90 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-sm backdrop-blur-md dark:bg-emerald-600/90">
              <Sparkles className="h-2.5 w-2.5" />
              <span>#{String(priorityRank).padStart(2, "0")}</span>
            </div>
          ) : priorityTag ? (
            <div className="absolute left-2.5 top-2.5 z-10 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background shadow-sm backdrop-blur-sm">
              {priorityTag}
            </div>
          ) : null}

          {/* savings badge */}
          {product.compareAtPrice ? (
            <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              Save {formatKES(product.compareAtPrice - product.price)}
            </span>
          ) : null}

          {/* prescription pill */}
          {product.requiresPrescription ? (
            <span className="absolute left-2.5 bottom-2.5 z-10 flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50/95 px-2 py-0.5 text-[10px] font-bold text-amber-800 shadow-sm backdrop-blur-md dark:border-amber-700/80 dark:bg-slate-900/90 dark:text-amber-300">
              ℞ Rx
            </span>
          ) : null}

          {/* wishlist heart */}
          <button
            onClick={handleWish}
            aria-label={wishHas ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
            aria-pressed={wishHas}
            className={cn(
              "absolute right-2.5 bottom-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-transform duration-200 hover:scale-110 active:scale-95",
              wishHas
                ? "border-rose-200 bg-rose-50/95 text-rose-600 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-300"
                : "border-border/70 bg-card/90 text-muted-foreground hover:text-rose-600 dark:bg-background/90"
            )}
          >
            <Heart className={cn("h-4 w-4", wishHas && "fill-rose-500 text-rose-500")} />
          </button>

          {outOfStock ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
              <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow">
                Out of Stock
              </span>
            </div>
          ) : null}
        </div>

        {/* details */}
        <div className="flex flex-1 flex-col justify-between p-3.5 sm:p-4 space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="font-semibold uppercase tracking-wider truncate">
                {product.brand || "Sphere"}
              </span>
              {product.packSize ? <span className="shrink-0">{product.packSize}</span> : null}
            </div>

            <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
              {product.name}
            </h3>

            {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
              <StarRow value={product.avgRating} count={product.reviewCount} size={3} />
            ) : null}
          </div>

          <div className="space-y-2 pt-1 border-t border-border/40">
            <div className="flex items-baseline justify-between gap-1.5">
              <div className="flex items-baseline gap-1.5">
                <span className="tnum text-base font-extrabold text-foreground">
                  {formatKES(product.price)}
                </span>
                {product.compareAtPrice ? (
                  <span className="tnum text-xs text-muted-foreground line-through">
                    {formatKES(product.compareAtPrice)}
                  </span>
                ) : null}
              </div>
              {isLowStock ? (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  Low stock
                </span>
              ) : null}
            </div>

            {showQuickAdd ? (
              <Button
                size="sm"
                className="btn-sheen h-9 w-full gap-1.5 rounded-xl text-xs font-semibold"
                variant={product.requiresPrescription ? "outline" : "default"}
                disabled={outOfStock}
                onClick={handleAdd}
              >
                {outOfStock ? (
                  "Unavailable"
                ) : product.requiresPrescription ? (
                  <>
                    <ShoppingCart className="h-3.5 w-3.5" /> ℞ Add · Review
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Add to cart
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProductCardCompact({ product }: ProductCardProps) {
  const navigate = useAppStore((s) => s.navigate)
  return (
    <button
      onClick={() => navigate("product", { productId: product.id })}
      className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <ProductImage
        src={product.image}
        alt={product.name}
        className="h-12 w-12 shrink-0 rounded-lg border bg-muted"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{product.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.brand}
          {product.packSize ? ` · ${product.packSize}` : ""}
        </span>
        {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />{" "}
            {product.avgRating.toFixed(1)} · {product.reviewCount} reviews
          </span>
        ) : null}
      </span>
      <span className="tnum text-sm font-bold text-primary">{formatKES(product.price)}</span>
      {product.requiresPrescription ? <RxFlagBadge compact /> : null}
    </button>
  )
}
