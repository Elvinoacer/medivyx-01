"use client"

import { Button } from "@/components/ui/button"
import { ProductImage } from "@/components/shared/product-image"
import { StarRow } from "@/components/shared/product-card"
import type { ProductDTO } from "@/lib/types"
import { formatKES } from "@/lib/format"
import { useCartStore } from "@/store/use-cart-store"
import { useWishStore } from "@/store/use-wish-store"
import { useAppStore } from "@/store/use-app-store"
import { toast } from "sonner"
import { ArrowUpRight, Heart, Plus, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface PremiumPopularCardProps {
  product: ProductDTO
  rank: number
}

export function PremiumPopularCard({ product, rank }: PremiumPopularCardProps) {
  const navigate = useAppStore((s) => s.navigate)
  const add = useCartStore((s) => s.add)
  const wishToggle = useWishStore((s) => s.toggle)
  const wishHas = useWishStore((s) => s.has(product.id))
  const outOfStock = product.stockStatus === "OUT_OF_STOCK" || product.stockStatus === "DISCONTINUED"

  function handleAdd(event?: React.MouseEvent) {
    event?.stopPropagation()
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

  function handleWish(event: React.MouseEvent) {
    event.stopPropagation()
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
    <article
      className={cn(
        "premium-popular-card group relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/95 shadow-[0_16px_50px_-28px_hsl(275_55%_25%_/_0.35)] transition-all duration-500 hover:-translate-y-1 hover:border-violet-300/50 hover:shadow-[0_26px_65px_-28px_hsl(275_65%_35%_/_0.45)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-[0_20px_55px_-28px_hsl(275_80%_65%_/_0.26)]"
      )}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-violet-500/[0.08] via-fuchsia-400/[0.03] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-violet-300/[0.12]" aria-hidden />

      <button
        type="button"
        onClick={() => navigate("product", { productId: product.id })}
        className="block w-full text-left"
        aria-label={`View ${product.name}`}
      >
        <div className="relative aspect-[1.08/1] overflow-hidden bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 dark:from-violet-950/40 dark:via-slate-950/20 dark:to-fuchsia-950/30">
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/70 bg-white/75 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-violet-800 uppercase shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/65 dark:text-violet-200">
            <Sparkles className="h-3 w-3" /> {rank === 1 ? "Most loved" : rank <= 3 ? "Popular" : "Trending"}
          </div>

          {product.compareAtPrice ? (
            <span className="absolute right-3 top-3 z-10 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white shadow-lg">
              Save {formatKES(product.compareAtPrice - product.price)}
            </span>
          ) : null}

          <div className="absolute inset-4 rounded-[1.1rem] bg-white/50 shadow-inner ring-1 ring-white/70 backdrop-blur-[1px] dark:bg-white/[0.03] dark:ring-white/10" aria-hidden />
          <ProductImage
            src={product.image}
            alt={`${product.name}${product.packSize ? ` — ${product.packSize}` : ""}`}
            className={cn("relative z-[1] h-full w-full", outOfStock && "grayscale")}
            imgClassName="object-contain p-5 transition-transform duration-700 ease-out group-hover:scale-110"
          />

          <button
            type="button"
            onClick={handleWish}
            aria-label={wishHas ? `Remove ${product.name} from saved items` : `Save ${product.name} for later`}
            aria-pressed={wishHas}
            className={cn(
              "absolute bottom-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95",
              wishHas
                ? "border-rose-200 bg-rose-50/95 text-rose-600 dark:border-rose-900 dark:bg-rose-950/85 dark:text-rose-300"
                : "border-white/80 bg-white/82 text-slate-600 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200"
            )}
          >
            <Heart className={cn("h-4.5 w-4.5", wishHas && "fill-rose-500 text-rose-500")} />
          </button>

          {product.requiresPrescription ? (
            <span className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 py-1 text-[10px] font-bold text-amber-800 shadow-sm backdrop-blur dark:border-amber-900 dark:bg-amber-950/85 dark:text-amber-300">
              <ShieldCheck className="h-3 w-3" /> Rx review
            </span>
          ) : null}
        </div>
      </button>

      <div className="relative space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-600/80 dark:text-violet-300/80">
              {product.brand || "Sphere pick"}
            </p>
            <button
              type="button"
              onClick={() => navigate("product", { productId: product.id })}
              className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground hover:text-violet-700 dark:hover:text-violet-300"
            >
              {product.name}
            </button>
          </div>
          <span className="shrink-0 rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-400/10 dark:text-violet-200">
            #{String(rank).padStart(2, "0")}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
            <StarRow value={product.avgRating} count={product.reviewCount} size={3} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" /> Community favourite
            </span>
          )}
          <span className="tnum text-lg font-extrabold tracking-tight text-foreground">{formatKES(product.price)}</span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="button"
            className="h-10 flex-1 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 font-semibold text-white shadow-[0_10px_24px_-12px_hsl(275_70%_45%_/_0.7)] transition-transform hover:scale-[1.01] hover:from-violet-500 hover:via-purple-500 hover:to-fuchsia-500"
            disabled={outOfStock}
            onClick={(event) => handleAdd(event)}
          >
            <ShoppingBag className="h-4 w-4" />
            {outOfStock ? "Unavailable" : "Add to cart"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl border-violet-200/70 bg-violet-50/40 text-violet-700 hover:bg-violet-100 dark:border-violet-400/20 dark:bg-violet-400/[0.05] dark:text-violet-200"
            onClick={() => navigate("product", { productId: product.id })}
            aria-label={`View ${product.name}`}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground dark:border-white/10">
          <Plus className="h-3.5 w-3.5 text-violet-500" />
          <span>{product.packSize ? product.packSize : "Curated for everyday care"}</span>
        </div>
      </div>
    </article>
  )
}
