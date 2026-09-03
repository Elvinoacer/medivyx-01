"use client"

import { ProductImage } from "@/components/shared/product-image"
import type { CategoryDTO } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Layers } from "lucide-react"

interface LuxuryCategoryRibbonProps {
  categories: CategoryDTO[] | null
  activeCategoryId: string
  totalProductCount: number
  onSelectCategory: (id: string | null) => void
}

export function LuxuryCategoryRibbon({
  categories,
  activeCategoryId,
  totalProductCount,
  onSelectCategory,
}: LuxuryCategoryRibbonProps) {
  if (!categories || categories.length === 0) return null

  return (
    <div className="relative py-2">
      <div className="scroll-slim flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-0.5">
        {/* All Products pill */}
        <button
          onClick={() => onSelectCategory(null)}
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all",
            !activeCategoryId
              ? "border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]"
              : "border-border/70 bg-card/80 text-foreground hover:border-primary/40 hover:bg-muted/80"
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>All Products</span>
          {totalProductCount > 0 ? (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px]",
                !activeCategoryId ? "bg-primary-foreground/20 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {totalProductCount}
            </span>
          ) : null}
        </button>

        {/* Individual Category pills */}
        {categories.map((c) => {
          const isActive = activeCategoryId === c.id
          return (
            <button
              key={c.id}
              onClick={() => onSelectCategory(isActive ? null : c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition-all hover:scale-[1.02]",
                isActive
                  ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40"
                  : "border-border/70 bg-card/80 text-foreground/85 hover:border-primary/40 hover:text-foreground"
              )}
            >
              <ProductImage
                src={c.icon}
                alt=""
                className="h-4 w-4 rounded-full"
                fallback="/images/cat-fallback.webp"
              />
              <span className="truncate max-w-[150px]">{c.name}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-medium",
                  isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                {c.productCount}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
