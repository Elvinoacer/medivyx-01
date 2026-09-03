"use client"

// Catalogue — product table with search/category/stock filters, inline quick stock
// steppers, Rx + availability toggles, full product editor dialog (create/edit),
// CSV bulk import (paste or file, with template download) and admin-only delete.
// "Active" is modelled as the opposite of the DISCONTINUED stock status (the DTO
// has no separate active flag) — discontinued products are hidden from the storefront.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { EmptyState, SectionHeader } from "@/components/shared/empty-state"
import { ProductImage } from "@/components/shared/product-image"
import { StockStatusBadge } from "@/components/shared/status-badges"
import { adminApi, catalogApi, storageApi } from "@/lib/api-client"
import type { CategoryDTO, ProductDTO } from "@/lib/types"
import { PRODUCT_IMAGE_LIBRARY } from "@/lib/image-library"
import { FALLBACK_PRODUCT_IMAGE, productImageSrc, sanitizeImageInput } from "@/lib/image"
import { STOCK_LABELS, STOCK_STATUSES, type StockStatus } from "@/lib/constants"
import { formatKES } from "@/lib/format"
import { useAuthStore } from "@/store/use-auth-store"
import { toast } from "sonner"
import { apiErrorMessage, downloadCsv, useDebounced, type SectionProps } from "../admin-shared"
import {
  Search, Pill, Loader2, Plus, Minus, Upload, Download, FileUp, Trash2, Pencil, Package, Dices,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Real product photos shipped in public/images/products — the editor picks from these.
const IMAGE_LIBRARY = PRODUCT_IMAGE_LIBRARY

const CSV_COLUMNS = [
  "name", "sku", "category", "brand", "packSize", "price", "compareAtPrice",
  "stockQty", "stockStatus", "requiresPrescription", "description", "image",
] as const

const CSV_TEMPLATE_ROWS: string[][] = [
  [...CSV_COLUMNS],
  ["Paracetamol 500mg Tablets", "SPH-PAI-101", "Pain & Fever", "Generic", "24 tablets", "150", "180", "60", "IN_STOCK", "false", "For pain and fever relief", "/images/products/panadol-tablets.webp"],
  ["Amoxicillin 500mg Capsules", "SPH-ANT-102", "Antibiotics", "Cipla", "21 capsules", "480", "0", "12", "LOW_STOCK", "true", "Antibiotic — prescription only", "/images/products/antibiotic-capsules.webp"],
]

const LOW_STOCK_THRESHOLD = 10

function stockStatusForQty(qty: number): StockStatus {
  if (qty <= 0) return "OUT_OF_STOCK"
  if (qty <= LOW_STOCK_THRESHOLD) return "LOW_STOCK"
  return "IN_STOCK"
}

export function CatalogueSection({ refreshKey, onRefresh }: SectionProps) {
  const role = useAuthStore((s) => s.session?.role)
  const isAdmin = role === "ADMIN"

  const [products, setProducts] = useState<ProductDTO[]>([])
  const [categories, setCategories] = useState<CategoryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const search = useDebounced(searchInput.trim(), 300)
  const [categoryFilter, setCategoryFilter] = useState("ALL")
  const [stockFilter, setStockFilter] = useState("ANY")

  const [editor, setEditor] = useState<{ mode: "create" | "edit"; product?: ProductDTO } | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)
  const [deleteFor, setDeleteFor] = useState<ProductDTO | null>(null)
  const [stockBusyId, setStockBusyId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async (searchTerm: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await catalogApi.products(searchTerm ? { search: searchTerm, pageSize: 200 } : { pageSize: 200 })
      setProducts(res.items)
    } catch (err) {
      setError(apiErrorMessage(err))
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(search)
  }, [load, search, refreshKey])

  useEffect(() => {
    catalogApi
      .categories()
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [refreshKey])

  const visible = useMemo(
    () =>
      products
        .filter((p) => (categoryFilter === "ALL" ? true : p.categoryId === categoryFilter))
        .filter((p) => (stockFilter === "ANY" ? true : p.stockStatus === stockFilter))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products, categoryFilter, stockFilter]
  )

  const lowCount = products.filter((p) => p.stockStatus === "LOW_STOCK").length
  const outCount = products.filter((p) => p.stockStatus === "OUT_OF_STOCK").length
  const discontinuedCount = products.filter((p) => p.stockStatus === "DISCONTINUED").length

  async function patchProduct(id: string, data: Partial<ProductDTO>, successMsg?: string) {
    setStockBusyId(id)
    try {
      const updated = await adminApi.updateProduct(id, data)
      setProducts((list) => list.map((p) => (p.id === id ? { ...p, ...updated } : p)))
      if (successMsg) toast.success(successMsg)
      onRefresh()
      return true
    } catch (err) {
      toast.error(apiErrorMessage(err))
      return false
    } finally {
      setStockBusyId(null)
    }
  }

  async function adjustStock(product: ProductDTO, delta: number) {
    const qty = Math.max(0, product.stockQty + delta)
    await patchProduct(product.id, { stockQty: qty, stockStatus: stockStatusForQty(qty) })
  }

  async function toggleDiscontinued(product: ProductDTO) {
    const next: StockStatus =
      product.stockStatus === "DISCONTINUED"
        ? stockStatusForQty(product.stockQty) // reactivate
        : "DISCONTINUED"
    await patchProduct(
      product.id,
      { stockStatus: next },
      next === "DISCONTINUED" ? `${product.name} discontinued (hidden from storefront).` : `${product.name} reactivated.`
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Catalogue"
        subtitle="Products, pricing and stock. Changes appear on the storefront immediately."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => setCsvOpen(true)}>
              <Upload className="h-4 w-4" /> CSV import
            </Button>
            {isAdmin ? (
              <Button className="gap-1.5" onClick={() => setEditor({ mode: "create" })}>
                <Plus className="h-4 w-4" /> Add product
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" role="alert">
          <p className="font-semibold">Couldn&apos;t load the catalogue</p>
          <p className="mt-0.5">{error}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => void load(search)}>Retry</Button>
        </div>
      ) : null}

      {/* filters */}
      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:p-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, SKU or brand…"
              className="pl-9"
              aria-label="Search catalogue"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="sm:w-56" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name} ({c.productCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="sm:w-48" aria-label="Filter by stock status">
              <SelectValue placeholder="Stock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ANY">Any stock state</SelectItem>
              {STOCK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STOCK_LABELS[s]}
                  {s === "LOW_STOCK" && lowCount > 0 ? ` (${lowCount})` : ""}
                  {s === "OUT_OF_STOCK" && outCount > 0 ? ` (${outCount})` : ""}
                  {s === "DISCONTINUED" && discontinuedCount > 0 ? ` (${discontinuedCount})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* list */}
      {loading ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Pill}
          title={products.length === 0 ? "No products found" : "No products match these filters"}
          description={products.length === 0 ? "Add your first product or import the starter CSV." : "Try clearing the search or stock filter."}
          action={products.length === 0 && isAdmin ? { label: "Add product", onClick: () => setEditor({ mode: "create" }) } : undefined}
        />
      ) : (
        <Card className="overflow-hidden">
          <ScrollArea className="scroll-slim">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Image</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-center">Rx</TableHead>
                  <TableHead className="text-center">Live</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((product) => (
                  <TableRow
                    key={product.id}
                    className={cn(
                      product.stockStatus === "OUT_OF_STOCK" && "bg-rose-50/60 dark:bg-rose-950/20",
                      product.stockStatus === "DISCONTINUED" && "opacity-60"
                    )}
                  >
                    <TableCell>
                      <span className="block h-10 w-10 overflow-hidden rounded-lg border bg-muted" aria-hidden>
                        <ProductImage src={product.image} alt="" className="h-full w-full" />
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-56 truncate text-sm font-semibold">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.brand ?? "—"}
                        {product.packSize ? ` · ${product.packSize}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{product.sku}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{product.categoryName ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <button
                        className="font-semibold tabular-nums hover:underline"
                        onClick={() => setEditor({ mode: "edit", product })}
                        aria-label={`Edit ${product.name} price (currently ${formatKES(product.price)})`}
                      >
                        {formatKES(product.price)}
                      </button>
                      {product.compareAtPrice && product.compareAtPrice > product.price ? (
                        <p className="text-xs text-muted-foreground line-through">{formatKES(product.compareAtPrice)}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={stockBusyId === product.id || product.stockQty <= 0}
                          onClick={() => void adjustStock(product, -1)}
                          aria-label={`Decrease stock of ${product.name}`}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">
                          {stockBusyId === product.id ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" aria-hidden /> : product.stockQty}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          disabled={stockBusyId === product.id}
                          onClick={() => void adjustStock(product, +1)}
                          aria-label={`Increase stock of ${product.name}`}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <StockStatusBadge status={product.stockStatus} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={product.requiresPrescription}
                        disabled={stockBusyId === product.id}
                        onCheckedChange={(checked) => void patchProduct(product.id, { requiresPrescription: checked })}
                        aria-label={`Toggle prescription requirement for ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={product.stockStatus !== "DISCONTINUED"}
                        disabled={stockBusyId === product.id}
                        onCheckedChange={() => void toggleDiscontinued(product)}
                        aria-label={`Toggle storefront visibility for ${product.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditor({ mode: "edit", product })}
                          aria-label={`Edit ${product.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                            onClick={() => setDeleteFor(product)}
                            aria-label={`Delete ${product.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            Showing {visible.length} of {products.length} products
            {lowCount + outCount > 0 ? ` · ${lowCount} low stock, ${outCount} out of stock` : ""}
            {" · “Live” off = discontinued (hidden from storefront)"}
          </p>
        </Card>
      )}

      {/* product editor */}
      {editor ? (
        <ProductEditorDialog
          mode={editor.mode}
          product={editor.product}
          categories={categories}
          onClose={() => setEditor(null)}
          onSaved={(saved) => {
            setEditor(null)
            if (editor.mode === "create") {
              setProducts((list) => [saved, ...list])
            } else if (editor.product) {
              setProducts((list) => list.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)))
            }
            onRefresh()
          }}
        />
      ) : null}

      {/* CSV import */}
      {csvOpen ? (
        <CsvImportDialog
          onClose={() => setCsvOpen(false)}
          onImported={() => {
            void load(search)
            onRefresh()
          }}
        />
      ) : null}

      {/* delete confirm */}
      {deleteFor ? (
        <Dialog open onOpenChange={(open) => !open && !deleteBusy && setDeleteFor(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" aria-hidden /> Delete product?
              </DialogTitle>
              <DialogDescription>
                “{deleteFor.name}” will be removed permanently. Past orders keep their line-item records. Consider
                marking it discontinued instead to keep the history tidy.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setDeleteFor(null)} disabled={deleteBusy}>Keep product</Button>
              <Button
                variant="destructive"
                disabled={deleteBusy}
                onClick={async () => {
                  if (!deleteFor) return
                  setDeleteBusy(true)
                  try {
                    await adminApi.deleteProduct(deleteFor.id)
                    toast.success(`${deleteFor.name} deleted.`)
                    setProducts((list) => list.filter((p) => p.id !== deleteFor.id))
                    setDeleteFor(null)
                    onRefresh()
                  } catch (err) {
                    toast.error(apiErrorMessage(err))
                  } finally {
                    setDeleteBusy(false)
                  }
                }}
              >
                {deleteBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

// ---------- product editor dialog ----------

interface ProductForm {
  name: string
  sku: string
  categoryId: string
  brand: string
  packSize: string
  price: string
  compareAtPrice: string
  stockQty: string
  stockStatus: StockStatus
  description: string
  usageInfo: string
  warnings: string
  image: string
  requiresPrescription: boolean
}

function formFromProduct(p?: ProductDTO, categories?: CategoryDTO[]): ProductForm {
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    categoryId: p?.categoryId ?? (categories?.[0]?.id ?? ""),
    brand: p?.brand ?? "",
    packSize: p?.packSize ?? "",
    price: p ? String(p.price) : "",
    compareAtPrice: p?.compareAtPrice ? String(p.compareAtPrice) : "",
    stockQty: p ? String(p.stockQty) : "0",
    stockStatus: p?.stockStatus ?? "IN_STOCK",
    description: p?.description ?? "",
    usageInfo: p?.usageInfo ?? "",
    warnings: p?.warnings ?? "",
    image: p?.image ?? FALLBACK_PRODUCT_IMAGE,
    requiresPrescription: p?.requiresPrescription ?? false,
  }
}

function suggestSku(categories: CategoryDTO[], categoryId: string): string {
  const cat = categories.find((c) => c.id === categoryId)
  const prefix = cat ? cat.name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() : "XX"
  const num = Math.floor(100 + Math.random() * 900)
  return `SPH-${prefix || "XX"}-${num}`
}

function ProductEditorDialog({
  mode,
  product,
  categories,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  product?: ProductDTO
  categories: CategoryDTO[]
  onClose: () => void
  onSaved: (saved: ProductDTO) => void
}) {
  const [form, setForm] = useState<ProductForm>(() => formFromProduct(product, categories))
  const [busy, setBusy] = useState(false)
  const imageUploadRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const res = await storageApi.uploadFile(file, "products")
      set("image", res.url)
      toast.success("Photo uploaded to Cloudflare R2!")
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setUploadingImage(false)
      if (e.target) e.target.value = ""
    }
  }

  useEffect(() => {
    if (mode === "create") {
      setForm((f) => ({ ...f, sku: suggestSku(categories, f.categoryId) }))
    }
  }, [form.categoryId])

  function set<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const priceNum = Number(form.price)
  const valid = form.name.trim().length >= 2 && Number.isFinite(priceNum) && priceNum > 0

  async function save() {
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        categoryId: form.categoryId || null,
        brand: form.brand.trim() || null,
        packSize: form.packSize.trim() || null,
        price: priceNum,
        compareAtPrice: form.compareAtPrice.trim() ? Number(form.compareAtPrice) : null,
        stockQty: Math.max(0, Math.floor(Number(form.stockQty) || 0)),
        stockStatus: form.stockStatus,
        description: form.description.trim(),
        usageInfo: form.usageInfo.trim() || null,
        warnings: form.warnings.trim() || null,
        image: form.image.trim() ? sanitizeImageInput(form.image) : FALLBACK_PRODUCT_IMAGE,
        requiresPrescription: form.requiresPrescription,
      }
      const saved =
        mode === "create"
          ? await adminApi.upsertProduct(payload)
          : await adminApi.updateProduct(product!.id, payload)
      toast.success(mode === "create" ? `${saved.name} added to the catalogue.` : `${saved.name} updated.`)
      onSaved(saved)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-2xl max-h-[92dvh] flex-col overflow-hidden rounded-xl p-0 sm:w-full">
        <DialogHeader className="border-b p-3 pr-12 pb-3 sm:p-4 sm:pr-12">
          <DialogTitle className="pr-2 text-base leading-snug sm:text-lg">{mode === "create" ? "Add product" : `Edit ${product?.name ?? "product"}`}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "New products appear on the storefront immediately — remember to set stock and the Rx flag."
              : "Changes go live on the storefront immediately."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid min-w-0 gap-3 p-3 sm:gap-4 sm:p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-name">Name *</Label>
              <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Paracetamol 500mg Tablets" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku" className="flex items-center justify-between">
                SKU
                {mode === "create" ? (
                  <button className="flex items-center gap-1 text-xs font-normal text-primary hover:underline" onClick={() => set("sku", suggestSku(categories, form.categoryId))}>
                    <Dices className="h-3 w-3" aria-hidden /> Regenerate
                  </button>
                ) : null}
              </Label>
              <Input id="p-sku" value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="SPH-XXX-000" className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-category">Category</Label>
              <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                <SelectTrigger id="p-category" aria-label="Product category">
                  <SelectValue placeholder="Choose category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-brand">Brand</Label>
              <Input id="p-brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="e.g. Dawa, Cipla, Generic" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pack">Pack size</Label>
              <Input id="p-pack" value={form.packSize} onChange={(e) => set("packSize", e.target.value)} placeholder="e.g. 24 tablets" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price (KSh) *</Label>
              <Input id="p-price" type="number" min={1} value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="150" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-compare">Compare-at price (KSh)</Label>
              <Input id="p-compare" type="number" min={0} value={form.compareAtPrice} onChange={(e) => set("compareAtPrice", e.target.value)} placeholder="180 (optional, shows a discount)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stock quantity</Label>
              <Input id="p-stock" type="number" min={0} value={form.stockQty} onChange={(e) => set("stockQty", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stockstatus">Stock status</Label>
              <Select value={form.stockStatus} onValueChange={(v) => set("stockStatus", v as StockStatus)}>
                <SelectTrigger id="p-stockstatus" aria-label="Stock status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STOCK_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Product photo</Label>
              <p className="text-xs text-muted-foreground">
                Pick from the library of real product photos (or paste any image path/URL).
              </p>
              <div className="grid max-h-40 grid-cols-5 gap-1.5 overflow-y-auto pr-0.5 xs:grid-cols-6 sm:flex sm:max-h-none sm:flex-wrap sm:overflow-visible" role="group" aria-label="Product photo library">
                {IMAGE_LIBRARY.map((img) => (
                  <button
                    key={img.path}
                    type="button"
                    onClick={() => set("image", img.path)}
                    aria-pressed={productImageSrc(form.image) === img.path}
                    aria-label={`Use photo: ${img.label}`}
                    title={img.label}
                    className={cn(
                      "aspect-square h-auto w-full overflow-hidden rounded-lg border transition-colors sm:h-12 sm:w-12",
                      productImageSrc(form.image) === img.path ? "border-primary ring-2 ring-primary/30" : "hover:bg-accent/60"
                    )}
                  >
                    <ProductImage src={img.path} alt="" className="h-full w-full" />
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={() => imageUploadRef.current?.click()}
                  disabled={uploadingImage}
                >
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploadingImage ? "Uploading to Cloudflare R2…" : "Upload custom photo to R2"}
                </Button>
                <input
                  ref={imageUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <span className="text-[11px] text-muted-foreground">or select a preset above</span>
              </div>
              <Input
                id="p-image"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="/images/products/generic-medicine.webp or https://..."
                className="mt-1.5 font-mono text-xs"
                aria-label="Custom image path or URL"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea id="p-desc" value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="Short customer-facing description" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-usage">Usage info</Label>
              <Textarea id="p-usage" value={form.usageInfo} onChange={(e) => set("usageInfo", e.target.value)} rows={2} placeholder="How to take/use (optional)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-warnings">Warnings</Label>
              <Textarea id="p-warnings" value={form.warnings} onChange={(e) => set("warnings", e.target.value)} rows={2} placeholder="Cautions (optional)" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <Label htmlFor="p-rx" className="text-sm">Prescription-only</Label>
                <p className="text-xs text-muted-foreground">Customers must upload a prescription before dispensing.</p>
              </div>
              <Switch id="p-rx" checked={form.requiresPrescription} onCheckedChange={(v) => set("requiresPrescription", v)} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t bg-muted/30 p-3 sm:p-4 [&>button]:w-full sm:[&>button]:w-auto">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void save()} disabled={busy || !valid}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === "create" ? "Add product" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- CSV import dialog ----------

function CsvImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [csv, setCsv] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null)

  async function runImport() {
    if (!csv.trim()) return
    setBusy(true)
    try {
      const res = await adminApi.importCsv(csv)
      setResult(res)
      if (res.errors.length === 0) {
        toast.success(`Import complete — ${res.created} created, ${res.updated} updated.`)
        onImported()
      } else {
        toast.warning(`Imported with ${res.errors.length} row error${res.errors.length === 1 ? "" : "s"} — see details.`)
        onImported()
      }
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function readFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      setCsv(String(reader.result ?? ""))
    }
    reader.readAsText(file)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4 text-muted-foreground" aria-hidden /> Bulk CSV import
          </DialogTitle>
          <DialogDescription>
            Paste CSV text or choose a file. Existing SKUs are updated; new rows are created.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="scroll-slim min-h-0 flex-1">
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-dashed bg-muted/30 p-3">
              <p className="text-xs font-semibold">Expected columns (in order)</p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {[...CSV_COLUMNS].join(", ")}
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <li>· <span className="font-medium">stockStatus</span>: IN_STOCK / LOW_STOCK / OUT_OF_STOCK / DISCONTINUED</li>
                <li>· <span className="font-medium">requiresPrescription</span>: true / false</li>
                <li>· Quote values containing commas; leave optional columns empty.</li>
              </ul>
              <Button
                size="sm"
                variant="outline"
                className="mt-2.5 gap-1.5"
                onClick={() => downloadCsv("sphere-products-template.csv", CSV_TEMPLATE_ROWS)}
              >
                <Download className="h-3.5 w-3.5" aria-hidden /> Download template
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="csv-text">Paste CSV</Label>
              <Textarea
                id="csv-text"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                rows={6}
                placeholder="name,sku,category,brand,packSize,price,compareAtPrice,stockQty,stockStatus,requiresPrescription,description,image"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="csv-file">Or upload a .csv file</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) readFile(file)
                }}
              />
            </div>

            {result ? (
              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  result.errors.length === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                )}
                role="status"
              >
                <p className="font-semibold">
                  {result.created} created · {result.updated} updated
                  {result.errors.length > 0 ? ` · ${result.errors.length} errors` : ""}
                </p>
                {result.errors.length > 0 ? (
                  <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-xs scroll-slim">
                    {result.errors.map((e, i) => (
                      <li key={i}>· {e}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/30 p-4">
          <p className="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" aria-hidden /> Imports are audit-logged.
          </p>
          <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
          <Button onClick={() => void runImport()} disabled={busy || !csv.trim()}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Upload className="mr-2 h-4 w-4" aria-hidden />}
            Import CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
