"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type PaginationMode = "infinite" | "pages"

interface HighPerformancePaginationProps {
  mode: PaginationMode
  currentPage: number
  pageSize: number
  totalItems: number
  loadedCount: number
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  className?: string
}

export function HighPerformancePagination({
  mode,
  currentPage,
  pageSize,
  totalItems,
  loadedCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onPageChange,
  onPageSizeChange,
  className,
}: HighPerformancePaginationProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [showBackToTop, setShowBackToTop] = useState(false)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const progressPercent = totalItems > 0 ? Math.min(100, Math.round((loadedCount / totalItems) * 100)) : 0

  // -------------------------------------------------------------
  // High-performance Infinite Scroll Observer with Prefetch Margin
  // -------------------------------------------------------------
  useEffect(() => {
    if (mode !== "infinite" || !hasMore || isLoadingMore) return

    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target?.isIntersecting) {
          onLoadMore()
        }
      },
      {
        root: null,
        rootMargin: "350px", // prefetch ahead for zero perceptible lag
        threshold: 0.1,
      }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
    }
  }, [mode, hasMore, isLoadingMore, onLoadMore])

  // -------------------------------------------------------------
  // Scroll-to-top floating button trigger
  // -------------------------------------------------------------
  useEffect(() => {
    function handleScroll() {
      setShowBackToTop(window.scrollY > 600)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  function scrollToTop() {
    window.scrollTo({ top: 120, behavior: "smooth" })
  }

  // Generate numbered pagination window
  function getPageNumbers(): (number | "ellipsis")[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | "ellipsis")[] = [1]

    if (currentPage > 3) {
      pages.push("ellipsis")
    }

    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis")
    }

    pages.push(totalPages)
    return pages
  }

  return (
    <div className={cn("mt-10 space-y-6", className)}>
      {/* ================= MODE 1: INFINITE SCROLL ================= */}
      {mode === "infinite" && (
        <div className="space-y-4">
          {/* Progress metric bar */}
          <div className="mx-auto max-w-md space-y-1.5 text-center">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>
                Displaying <strong className="text-foreground">{loadedCount}</strong> of{" "}
                <strong className="text-foreground">{totalItems}</strong> items
              </span>
              <span className="tnum font-bold text-primary">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Sentinel element observed by IntersectionObserver */}
          {hasMore ? (
            <div ref={sentinelRef} className="flex flex-col items-center justify-center py-6">
              {isLoadingMore ? (
                <div className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading additional items seamlessly…</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-6 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onLoadMore}
                >
                  Scroll down or click to load more
                </Button>
              )}
            </div>
          ) : totalItems > 0 ? (
            <div className="flex flex-col items-center justify-center gap-1.5 py-8 text-center border-t border-border/40">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>You&apos;ve viewed all {totalItems} available products</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-sm">
                Can&apos;t find an exact brand or strength? Message our pharmacist on WhatsApp for counter stock.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ================= MODE 2: NUMBERED PAGES ================= */}
      {mode === "pages" && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60 pt-6">
          {/* page size selector & meta */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              Page <strong className="text-foreground">{currentPage}</strong> of{" "}
              <strong className="text-foreground">{totalPages}</strong> ({totalItems} items)
            </span>

            {onPageSizeChange ? (
              <div className="flex items-center gap-1">
                <span>Show:</span>
                {[12, 24, 48].map((size) => (
                  <button
                    key={size}
                    onClick={() => onPageSizeChange(size)}
                    className={cn(
                      "rounded px-2 py-0.5 font-semibold transition-colors",
                      pageSize === size
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* page buttons */}
          <nav
            role="navigation"
            aria-label="Pagination Navigation"
            className="flex items-center gap-1 sm:gap-1.5"
          >
            {/* First & Prev */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(1)}
              aria-label="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Numbers */}
            {getPageNumbers().map((num, idx) =>
              num === "ellipsis" ? (
                <span key={`ell-${idx}`} className="px-1 text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={num}
                  variant={num === currentPage ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 min-w-8 rounded-lg px-2.5 text-xs font-semibold",
                    num === currentPage && "btn-sheen shadow-sm"
                  )}
                  onClick={() => onPageChange(num)}
                  aria-current={num === currentPage ? "page" : undefined}
                >
                  {num}
                </Button>
              )
            )}

            {/* Next & Last */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-lg"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              aria-label="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      )}

      {/* Floating Back-to-Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label="Back to top of products"
          className="fixed bottom-24 right-5 z-40 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3.5 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur-md transition-all hover:border-primary hover:text-primary hover:shadow-xl active:scale-95 sm:bottom-10 sm:right-10"
        >
          <ArrowUp className="h-3.5 w-3.5" />
          <span>Top</span>
        </button>
      )}
    </div>
  )
}
