"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RxFlagBadge, StockStatusBadge } from "@/components/shared/status-badges"
import { formatKES } from "@/lib/format"
import type { ProductDTO } from "@/lib/types"
import { useCartStore } from "@/store/use-cart-store"
import { useWishStore } from "@/store/use-wish-store"
import { useAppStore } from "@/store/use-app-store"
import { toast } from "sonner"
import { Plus, ShoppingCart, Info, Heart, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  product: ProductDTO
}

/* Soft emoji-tile gradient tints (teal / emerald / amber family only — no blue/indigo/violet).
   Picked deterministically from a hash of the product id so tiles are stable across renders. */
const TILE_TINTS = [
  "from-teal-50 via-emerald-50 to-teal-100/70 dark:from-teal-950/50 dark:via-emerald-950/40 dark:to-teal-900/40",
  "from-emerald-50 via-lime-50 to-emerald-100/70 dark:from-emerald-950/50 dark:via-lime-950/30 dark:to-emerald-900/40",
  "from-amber-50 via-orange-50 to-amber-100/70 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-900/30",
] as const

function tileTintFor(id: string): (typeof TILE_TINTS)[number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return TILE_TINTS[Math.abs(h) % TILE_TINTS.length]
}

export function StarRow({ value, count, size = 3.5 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Rated ${value} out of 5${count != null ? ` by ${count} customers` : ""}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size * 4, height: size * 4 }}
          className={cn(
            "shrink-0",
            i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
          )}
          aria-hidden
        />
      ))}
      {count != null ? <span className="ml-1 text-[11px] text-muted-foreground">({count})</span> : null}
    </span>
  )
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useAppStore((s) => s.navigate)
  const add = useCartStore((s) => s.add)
  const wishToggle = useWishStore((s) => s.toggle)
  const wishHas = useWishStore((s) => s.has(product.id))
  const outOfStock = product.stockStatus === "OUT_OF_STOCK" || product.stockStatus === "DISCONTINUED"

  function handleAdd() {
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
        : `${product.name} added to cart`
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
    toast.success(saved ? `${product.name} saved to your list` : `Removed ${product.name} from saved items`)
  }

  return (
    <Card
      className="card-lift shadow-soft group relative cursor-pointer overflow-hidden"
      onClick={() => navigate("product", { productId: product.id })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("product", { productId: product.id })}
      aria-label={`View ${product.name}`}
    >
      <CardContent className="p-0">
        {/* image / emoji tile */}
        <div className={cn(
          "relative flex h-32 items-center justify-center bg-gradient-to-br text-5xl",
          tileTintFor(product.id),
          outOfStock && "grayscale"
        )}>
          <span aria-hidden className="select-none transition-transform duration-300 group-hover:scale-110">
            {product.image ?? "💊"}
          </span>
          {product.compareAtPrice ? (
            <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              Save {formatKES(product.compareAtPrice - product.price)}
            </span>
          ) : null}
          {product.requiresPrescription ? (
            <span className="absolute right-2 top-2 rounded-full border border-rose-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-rose-700 shadow-sm backdrop-blur dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
              ℞ Rx
            </span>
          ) : null}
          {/* wishlist heart */}
          <button
            onClick={handleWish}
            aria-label={wishHas ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
            aria-pressed={wishHas}
            className={cn(
              "absolute right-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-all active:scale-90",
              outOfStock ? "bottom-8" : "bottom-2",
              wishHas
                ? "border-rose-200 bg-rose-50/95 text-rose-600 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                : "border-border/60 bg-white/85 text-muted-foreground hover:text-rose-600 dark:border-border dark:bg-background/80"
            )}
          >
            <Heart className={cn("h-4 w-4", wishHas && "fill-rose-500 text-rose-500")} />
          </button>
          {outOfStock ? (
            <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-white">
              Out of stock
            </span>
          ) : null}
        </div>

        {/* details */}
        <div className="space-y-1.5 p-3">
          <p className="line-clamp-2 min-h-[2.4rem] text-sm font-semibold leading-tight">{product.name}</p>
          <p className="text-xs text-muted-foreground">
            {product.brand}
            {product.packSize ? ` · ${product.packSize}` : ""}
          </p>
          {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
            <StarRow value={product.avgRating} count={product.reviewCount} />
          ) : null}
          <div className="flex items-baseline gap-1.5 pt-0.5">
            <span className="tnum text-base font-bold text-primary">{formatKES(product.price)}</span>
            {product.compareAtPrice ? (
              <span className="tnum text-xs text-muted-foreground line-through">{formatKES(product.compareAtPrice)}</span>
            ) : null}
          </div>
          <Button
            size="sm"
            className="btn-sheen h-8 w-full gap-1.5 text-xs"
            variant={product.requiresPrescription ? "outline" : "default"}
            disabled={outOfStock}
            onClick={(e) => {
              e.stopPropagation()
              handleAdd()
            }}
          >
            {outOfStock ? (
              "Unavailable"
            ) : product.requiresPrescription ? (
              <>
                <ShoppingCart className="h-3.5 w-3.5" /> Add · Rx review
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Add to cart
              </>
            )}
          </Button>
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
      className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/40"
    >
      <span className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-2xl",
        tileTintFor(product.id)
      )} aria-hidden>
        {product.image ?? "💊"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{product.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.brand}
          {product.packSize ? ` · ${product.packSize}` : ""}
        </span>
        {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden /> {product.avgRating.toFixed(1)} · {product.reviewCount} reviews
          </span>
        ) : null}
      </span>
      <span className="tnum text-sm font-bold text-primary">{formatKES(product.price)}</span>
      {product.requiresPrescription ? <RxFlagBadge compact /> : null}
      <Info className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  )
}
