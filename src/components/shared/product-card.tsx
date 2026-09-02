"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RxFlagBadge, StockStatusBadge } from "@/components/shared/status-badges"
import { ProductImage } from "@/components/shared/product-image"
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
      {count != null ? <span className="ml-1 text-xs text-muted-foreground">({count})</span> : null}
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
    toast.success(saved ? `${product.name} saved to your list` : `Removed ${product.name} from saved items`)
  }

  return (
    <Card
      className="card-lift shadow-soft group relative cursor-pointer overflow-hidden"
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
      <CardContent className="p-0">
        {/* real product photo */}
        <div className={cn("relative h-32 w-full bg-muted", outOfStock && "grayscale")}>
          <ProductImage
            src={product.image}
            alt={`${product.name}${product.packSize ? ` — ${product.packSize}` : ""}`}
            className="h-full w-full"
            imgClassName="transition-transform duration-300 group-hover:scale-105"
          />
          {product.compareAtPrice ? (
            <span className="absolute left-2 top-2 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
              Save {formatKES(product.compareAtPrice - product.price)}
            </span>
          ) : null}
          {product.requiresPrescription ? (
            <span className="absolute right-2 top-2 rounded-full border border-rose-200 bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-rose-700 shadow-sm backdrop-blur dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
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
            <span className="absolute inset-x-0 bottom-0 bg-rose-600/90 py-1 text-center text-[11px] font-bold uppercase tracking-widest text-white">
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
      <ProductImage
        src={product.image}
        alt={product.name}
        className="h-12 w-12 shrink-0 rounded-md border bg-muted"
      />
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
      <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  )
}
