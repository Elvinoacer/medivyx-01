"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ProductCard, StarRow } from "@/components/shared/product-card"
import { ProductImage } from "@/components/shared/product-image"
import { EmptyState, LoadingGrid, SectionHeader } from "@/components/shared/empty-state"
import { StockStatusBadge, RxFlagBadge, OtcBadge } from "@/components/shared/status-badges"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { useWishStore, useRecentStore } from "@/store/use-wish-store"
import { useAuthStore } from "@/store/use-auth-store"
import { catalogApi, promotionsApi } from "@/lib/api-client"
import type { ProductDTO, ProductsResponse, ReviewSummaryDTO } from "@/lib/types"
import { waLink } from "@/lib/constants"
import { formatKES, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  ArrowLeft, Minus, Plus, ShoppingCart, MessageCircle, FileWarning, CheckCircle2,
  Package, Info, TriangleAlert, Loader2, HeartPulse, Heart, Star, Bell, BellRing, PenLine,
} from "lucide-react"

// ============================== VIEW ==============================

export function ProductView() {
  const productId = useAppStore((s) => s.selectedProductId)
  const goBack = useAppStore((s) => s.goBack)
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const add = useCartStore((s) => s.add)
  const cartQty = useCartStore((s) => s.lines.find((line) => line.productId === productId)?.qty ?? 0)
  const wishToggle = useWishStore((s) => s.toggle)
  const wishHas = useWishStore((s) => s.has(productId ?? ""))
  const trackRecent = useRecentStore((s) => s.track)
  const session = useAuthStore((s) => s.session)
  const isCustomer = !!session?.user

  const [product, setProduct] = useState<ProductDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qty, setQty] = useState(1)

  useEffect(() => {
    if (!productId) return
    const id = productId
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      setError(null)
      setQty(1)
      try {
        const p = await catalogApi.product(id)
        if (cancelled) return
        setProduct(p)
        trackRecent(id)
      } catch (err: unknown) {
        if (cancelled) return
        if (err instanceof Error && /404|not found/i.test(err.message)) {
          setNotFound(true)
        } else {
          setError(err instanceof Error ? err.message : "Couldn't load product")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [productId, trackRecent])

  // related products from same category (result tagged with the product id it belongs to,
  // so switching products never shows stale related items)
  const [related, setRelated] = useState<{ pid: string; items: ProductDTO[] }>({ pid: "", items: [] })
  const [relatedLoading, setRelatedLoading] = useState(false)

  useEffect(() => {
    if (!product?.categoryId) return
    const pid = product.id
    const categoryId = product.categoryId
    let cancelled = false
    async function load() {
      setRelatedLoading(true)
      try {
        const res: ProductsResponse = await catalogApi.products({ category: categoryId, pageSize: 8, sort: "popular" })
        if (cancelled) return
        setRelated({ pid, items: res.items.filter((p) => p.id !== pid).slice(0, 4) })
      } catch {
        /* related products are non-critical */
      } finally {
        if (!cancelled) setRelatedLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [product?.categoryId, product?.id])

  const relatedItems = product && related.pid === product.id ? related.items : []

  // ---------- reviews ----------
  const [reviews, setReviews] = useState<ReviewSummaryDTO | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    if (!product?.id) return
    const id = product.id
    let cancelled = false
    async function load() {
      setReviewsLoading(true)
      try {
        const res = await catalogApi.reviews(id)
        if (!cancelled) setReviews(res)
      } catch {
        if (!cancelled) setReviews(null)
      } finally {
        if (!cancelled) setReviewsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [product?.id])

  // ---------- back-in-stock alert ----------
  const [alertBusy, setAlertBusy] = useState(false)
  const [alertSet, setAlertSet] = useState(false)

  useEffect(() => {
    setAlertSet(false)
  }, [productId])

  async function handleStockAlert() {
    if (!product) return
    if (!isCustomer) {
      openAuth("login", "product", "Sign in so we can alert you the moment it's back in stock.", { productId: product.id })
      return
    }
    setAlertBusy(true)
    try {
      await catalogApi.stockAlert.create(product.id)
      setAlertSet(true)
      toast.success(`We'll message you the moment ${product.name} is back in stock.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't set the alert — try again.")
    } finally {
      setAlertBusy(false)
    }
  }

  // ---------- states ----------

  if (!productId || notFound) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={Package}
          title="Product not found"
          description="This product may have been removed or the link is out of date. Browse the catalogue or ask us on WhatsApp."
          action={{ label: "Browse products", onClick: () => navigate("catalog") }}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-32 rounded-full" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load this product"
          description={error ?? "Something went wrong. Please try again."}
          action={{ label: "Back to catalogue", onClick: () => navigate("catalog") }}
        />
      </div>
    )
  }

  const outOfStock = product.stockStatus === "OUT_OF_STOCK" || product.stockStatus === "DISCONTINUED"
  const discount = product.compareAtPrice ? product.compareAtPrice - product.price : null

  const waText =
    `Hello Medivyx! I'd like to order:\n\n${product.name}` +
    (product.packSize ? ` (${product.packSize})` : "") +
    ` — ${formatKES(product.price)}${qty > 1 ? ` × ${qty}` : ""}` +
    `\n\nIs it available?`

  const handleAdd = () => {
    add(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        requiresPrescription: product.requiresPrescription,
        packSize: product.packSize,
        stockStatus: product.stockStatus,
      },
      qty
    )
    toast.success(
      product.requiresPrescription
        ? `${qty} × ${product.name} added — upload your prescription at checkout`
        : `${qty} × ${product.name} added to cart`,
      { action: { label: "View cart", onClick: () => navigate("cart") } }
    )
  }

  function handleWish() {
    if (!product) return
    const saved = wishToggle({
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      requiresPrescription: product.requiresPrescription,
      packSize: product.packSize,
      brand: product.brand,
    })
    toast.success(saved ? `${product.name} saved to your list` : `Removed from saved items`)
  }

  return (
    <div className="app-page app-page-product pb-10">

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* breadcrumb / back */}
        <div className="mb-5 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 rounded-full" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <nav className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex" aria-label="Breadcrumb">
            <button onClick={() => navigate("home")} className="hover:text-foreground hover:underline">
              Home
            </button>
            <span aria-hidden>/</span>
            <button onClick={() => navigate("catalog")} className="hover:text-foreground hover:underline">
              Shop
            </button>
            {product.categoryName ? (
              <>
                <span aria-hidden>/</span>
                <span className="truncate">{product.categoryName}</span>
              </>
            ) : null}
          </nav>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* ============ LEFT: visual ============ */}
          <div>
            <div
              className={cn(
                "card-lift relative aspect-square w-full overflow-hidden rounded-2xl border bg-muted",
                outOfStock && "grayscale"
              )}
            >
              <ProductImage
                src={product.image}
                alt={`${product.name}${product.packSize ? ` — ${product.packSize}` : ""}`}
                className="h-full w-full"
                imgClassName="object-contain p-6 transition-transform duration-500 group-hover:scale-[1.03] sm:p-10"
              />
              {discount ? (
                <span className="absolute left-4 top-4 rounded-full bg-rose-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md">
                  Save {formatKES(discount)}
                </span>
              ) : null}
              {product.requiresPrescription ? (
                <span className="absolute right-4 top-4">
                  <RxFlagBadge className="bg-white/90 shadow-md backdrop-blur dark:bg-rose-950/80" />
                </span>
              ) : (
                <span className="absolute right-4 top-4">
                  <OtcBadge className="bg-white/90 shadow-md backdrop-blur dark:bg-teal-950/80" />
                </span>
              )}
              {outOfStock ? (
                <span className="absolute inset-x-0 bottom-0 bg-rose-600/95 py-2.5 text-center text-xs font-bold uppercase tracking-widest text-white">
                  {product.stockStatus === "DISCONTINUED" ? "Discontinued" : "Out of stock"}
                </span>
              ) : null}
            </div>

            {/* stock + sku meta */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StockStatusBadge status={product.stockStatus} />
              {product.stockQty > 0 && product.stockQty <= 5 && !outOfStock ? (
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Only {product.stockQty} left — order soon
                </span>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">SKU: {product.sku}</span>
            </div>
          </div>

          {/* ============ RIGHT: details ============ */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{product.name}</h1>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "h-10 w-10 shrink-0 rounded-full",
                  wishHas && "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                )}
                onClick={handleWish}
                aria-label={wishHas ? "Remove from saved items" : "Save for later"}
                aria-pressed={wishHas}
              >
                <Heart className={cn("h-5 w-5", wishHas && "fill-rose-500 text-rose-500")} />
              </Button>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {product.brand ? <span className="font-semibold text-foreground/80">{product.brand}</span> : "Medivyx"}
              {product.packSize ? ` · ${product.packSize}` : ""}
              {product.categoryName ? ` · ${product.categoryName}` : ""}
            </p>

            {(product.reviewCount ?? 0) > 0 && product.avgRating ? (
              <button
                className="mt-2.5 flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                onClick={() => document.getElementById("reviews-section")?.scrollIntoView({ behavior: "smooth" })}
              >
                <StarRow value={product.avgRating} />
                <span className="font-semibold text-foreground/80">{product.avgRating.toFixed(1)}</span>
                <span className="text-muted-foreground">· {product.reviewCount} review{(product.reviewCount ?? 0) === 1 ? "" : "s"}</span>
              </button>
            ) : null}

            {/* price */}
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-3xl font-extrabold text-primary">{formatKES(product.price)}</span>
              {product.compareAtPrice ? (
                <span className="text-base text-muted-foreground line-through">{formatKES(product.compareAtPrice)}</span>
              ) : null}
              {discount ? <Badge className="bg-rose-600 text-white">{Math.round((discount / product.compareAtPrice!) * 100)}% off</Badge> : null}
            </div>

            {/* rx / otc banner */}
            <div className="mt-4">
              {product.requiresPrescription ? (
                <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 [&>svg]:text-amber-600">
                  <FileWarning className="h-4 w-4" />
                  <AlertTitle>Prescription required</AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-300">
                    Add this item to your cart and upload your prescription at checkout. A pharmacist verifies it before
                    dispensing — if anything needs clarification we&apos;ll call or WhatsApp you.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="product-otc-notice">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle className="font-semibold">No prescription needed</AlertTitle>
                  <AlertDescription>
                    This is an over-the-counter product — order straight away and pay by M-Pesa, card or cash.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* description */}
            <p className="mt-5 text-sm leading-relaxed text-foreground/90">{product.description}</p>

            {product.usageInfo ? (
              <div className="mt-4 rounded-xl border bg-muted/40 p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Info className="h-3.5 w-3.5" aria-hidden /> How to use
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{product.usageInfo}</p>
              </div>
            ) : null}

            {product.warnings ? (
              <div className="product-warning-notice mt-4 rounded-xl border p-4">
                <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Warnings & precautions
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed">{product.warnings}</p>
              </div>
            ) : null}

            <Separator className="mt-6" />

            {/* qty + add to cart */}
            {outOfStock ? (
              <div className="mt-6 rounded-2xl border border-dashed p-4 text-center">
                <p className="text-sm font-medium text-foreground/90">
                  {product.stockStatus === "DISCONTINUED" ? "This product has been discontinued." : "This product is out of stock right now."}
                </p>
                {product.stockStatus !== "DISCONTINUED" ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="mt-3 h-11 gap-2 rounded-full"
                    onClick={handleStockAlert}
                    disabled={alertBusy || alertSet}
                  >
                    {alertBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : alertSet ? <BellRing className="h-4 w-4 text-emerald-600" /> : <Bell className="h-4 w-4" />}
                    {alertSet ? "Alert set — we'll message you" : alertBusy ? "Setting alert…" : "Notify me when back in stock"}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="product-purchase-actions mt-6 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-full border" role="group" aria-label="Quantity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center text-base font-bold" aria-live="polite" aria-label={`Quantity ${qty}`}>
                    {qty}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full"
                    onClick={() => setQty((q) => Math.min(Math.max(1, product.stockQty || 1), q + 1))}
                    disabled={outOfStock || qty >= Math.max(1, Math.min(product.stockQty, 99))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  size="lg"
                  className="btn-sheen h-12 flex-1 gap-2 rounded-full px-6 text-base"
                  onClick={handleAdd}
                  aria-label={cartQty > 0 ? `Add another ${product.name} to cart. ${cartQty} already in cart` : `Add ${product.name} to cart`}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {cartQty > 0 ? `Add another · ${cartQty} in cart` : `Add to cart · ${formatKES(product.price * qty)}`}
                </Button>
              </div>
            )}

            <div className="product-secondary-actions mt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="lg" className="h-11 flex-1 gap-2 rounded-full">
                <a href={waLink(waText)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 text-emerald-600" /> Order via WhatsApp
                </a>
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="h-11 gap-2 rounded-full"
                onClick={() => {
                  handleAdd()
                  navigate("cart")
                }}
                disabled={outOfStock}
              >
                <HeartPulse className="h-4 w-4" /> Buy now
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Pickup on Lumumba Drive ready in ~2 hours · delivery across Nairobi · M-Pesa, card & cash accepted.
            </p>
          </div>
        </div>

        {/* ============ REVIEWS ============ */}
        <section id="reviews-section" className="mt-14 scroll-mt-24" aria-labelledby="reviews-heading">
          <SectionHeader
            title="Customer reviews"
            subtitle="Real feedback from verified Medivyx customers"
          />
          <h2 id="reviews-heading" className="sr-only">Customer reviews</h2>

          {reviewsLoading ? (
            <div className="grid gap-6 lg:grid-cols-3">
              <Skeleton className="h-48 rounded-2xl" />
              <div className="space-y-3 lg:col-span-2">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            </div>
          ) : !reviews || reviews.count === 0 ? (
            <div className="rounded-2xl border border-dashed bg-muted/30 px-4 py-10 text-center">
              <Star className="mx-auto h-8 w-8 text-muted-foreground/60" aria-hidden />
              <p className="mt-3 text-sm font-medium text-foreground/90">No reviews yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Bought this product? Sign in and share your experience to help other customers.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* summary card */}
              <Card className="shadow-soft h-fit border-border/70">
                <CardContent className="p-6 text-center">
                  <p className="tnum text-5xl font-extrabold text-foreground">{reviews.average.toFixed(1)}</p>
                  <div className="mt-2 flex justify-center">
                    <StarRow value={reviews.average} size={4.5} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Based on {reviews.count} review{reviews.count === 1 ? "" : "s"}
                  </p>
                  <div className="mt-5 space-y-1.5">
                    {reviews.breakdown.map((b) => (
                      <div key={b.rating} className="flex items-center gap-2 text-xs">
                        <span className="tnum flex w-8 items-center justify-end gap-1 text-right text-muted-foreground">
                          <span aria-hidden>{b.rating}</span>
                          <Star className="h-3 w-3 fill-muted-foreground text-muted-foreground" aria-hidden />
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${reviews.count ? (b.count / reviews.count) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="tnum w-6 text-muted-foreground">{b.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* review list + form */}
              <div className="space-y-4 lg:col-span-2">
                <ReviewsForm productId={product.id} isCustomer={isCustomer} onPosted={() => refetchReviews(product.id, setReviews)} />
                {reviews.reviews.map((r) => (
                  <Card key={r.id} className="shadow-soft">
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StarRow value={r.rating} />
                        <span className="text-sm font-semibold">{r.authorName}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                      </div>
                      {r.comment ? <p className="mt-2.5 text-sm leading-relaxed text-foreground/90">{r.comment}</p> : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ============ RELATED ============ */}
        <section className="mt-14" aria-labelledby="related-heading">
          <SectionHeader
            title={product.categoryName ? `More in ${product.categoryName}` : "You may also like"}
            subtitle="Frequently bought alongside this product"
          />
          <h2 id="related-heading" className="sr-only">
            Related products
          </h2>
          {relatedLoading ? (
            <LoadingGrid count={4} />
          ) : relatedItems.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              No related products right now.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {relatedItems.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {!outOfStock ? (
          <div className="product-mobile-action" aria-label="Product price and add to cart">
            <span>
              <small>{qty} × {product.packSize ?? "pack"}</small>
              <strong>{formatKES(product.price * qty)}</strong>
            </span>
            <Button size="lg" className="h-12 flex-1 gap-2 rounded-full text-base" onClick={handleAdd}>
              <ShoppingCart className="h-5 w-5" /> {cartQty > 0 ? `Add another · ${cartQty}` : "Add to cart"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ---------- helpers & sub-components ----------

async function refetchReviews(
  productId: string,
  setReviews: (r: ReviewSummaryDTO | null) => void
) {
  try {
    const res = await catalogApi.reviews(productId)
    setReviews(res)
  } catch {
    /* keep the current list on refetch failure */
  }
}

function ReviewsForm({
  productId,
  isCustomer,
  onPosted,
}: {
  productId: string
  isCustomer: boolean
  onPosted: () => void
}) {
  const openAuth = useAppStore((s) => s.openAuth)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [posted, setPosted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (posted) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30">
        <CardContent className="flex items-center gap-3 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-sm text-emerald-900 dark:text-emerald-200">
            Thanks for your review! It&apos;s now helping other customers shop with confidence.
          </p>
        </CardContent>
      </Card>
    )
  }

  async function submit() {
    if (rating < 1) {
      setError("Pick a star rating first.")
      return
    }
    setError(null)
    setBusy(true)
    try {
      await catalogApi.createReview(productId, { rating, comment: comment.trim() || undefined })
      setPosted(true)
      onPosted()
      toast.success("Review submitted — thank you!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your review — try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="shadow-soft border-border/70">
      <CardContent className="p-4 sm:p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <PenLine className="h-4 w-4 text-primary" aria-hidden /> Write a review
        </h3>

        {!isCustomer ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
            <p className="flex-1 text-sm text-muted-foreground">
              Sign in to your account to share your experience with this product.
            </p>
            <Button size="sm" variant="outline" onClick={() => openAuth("login", "product", "Sign in to leave a review.", { productId })}>
              Sign in
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-1" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((i) => {
                const active = i <= (hovered || rating)
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={rating === i}
                    aria-label={`${i} star${i > 1 ? "s" : ""}`}
                    className={cn("rounded-md p-1 transition-transform active:scale-90", active && rating === i && "star-pop")}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(i)}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        active ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"
                      )}
                    />
                  </button>
                )
              })}
              <span className="ml-2 text-xs text-muted-foreground">
                {rating > 0 ? ["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating] : "Tap to rate"}
              </span>
            </div>

            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share how the product worked for you (optional, max 500 characters)"
              className="mt-3 min-h-20 text-sm"
              maxLength={500}
              aria-label="Your review"
            />

            {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="tnum text-xs text-muted-foreground">{comment.length}/500</span>
              <Button size="sm" onClick={submit} disabled={busy || rating < 1}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit review
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
