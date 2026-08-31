import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { attachRatings, toProductDTO } from "@/lib/dto"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { STOCK_STATUSES, type StockStatus } from "@/lib/constants"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const category = url.searchParams.get("category")?.trim() ?? ""
  const rx = url.searchParams.get("rx") ?? "any"
  const availability = url.searchParams.get("availability") ?? "any"
  const sort = url.searchParams.get("sort") ?? "popular"
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12))

  const where: Record<string, unknown> = { active: true }
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { brand: { contains: search } },
      { sku: { contains: search } },
      { description: { contains: search } },
    ]
  }
  if (category) {
    // accept either category id or slug
    const cat = await db.category.findFirst({ where: { OR: [{ id: category }, { slug: category }] } })
    if (cat) where.categoryId = cat.id
    else where.categoryId = "___none___"
  }
  if (rx === "yes") where.requiresPrescription = true
  if (rx === "no") where.requiresPrescription = false
  if (availability === "in") where.stockStatus = "IN_STOCK"
  if (availability === "low") where.stockStatus = "LOW_STOCK"
  if (availability === "out") where.stockStatus = { in: ["OUT_OF_STOCK"] }

  let orderBy: Record<string, string> = { createdAt: "desc" }
  if (sort === "price-asc") orderBy = { price: "asc" }
  if (sort === "price-desc") orderBy = { price: "desc" }
  if (sort === "name") orderBy = { name: "asc" }
  if (sort === "newest") orderBy = { createdAt: "desc" }
  if (sort === "popular") {
    // products appearing most in order items, then newest
    const items = await db.orderItem.groupBy({ by: ["productId"], _count: { productId: true } })
    const popular = items.sort((a, b) => b._count.productId - a._count.productId).map((i) => i.productId)
    const products = await db.product.findMany({ where, include: { category: true } })
    products.sort((a, b) => {
      const ai = popular.indexOf(a.id)
      const bi = popular.indexOf(b.id)
      if (ai === -1 && bi === -1) return b.createdAt.getTime() - a.createdAt.getTime()
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
    const total = products.length
    const withRatings = await attachRatings(products)
    const items2 = withRatings.slice((page - 1) * pageSize, page * pageSize).map(toProductDTO)
    return NextResponse.json({ items: items2, total, page, pageSize })
  }

  const [total, products] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, include: { category: true }, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ])
  const withRatings = await attachRatings(products)
  return NextResponse.json({ items: withRatings.map(toProductDTO), total, page, pageSize })
}

function deriveStockStatus(qty: number, threshold: number): StockStatus {
  if (qty <= 0) return "OUT_OF_STOCK"
  if (qty <= threshold) return "LOW_STOCK"
  return "IN_STOCK"
}

export async function POST(request: Request) {
  const { session, error } = await requireStaff(["ADMIN", "PHARMACIST"])
  if (error) return error
  try {
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const price = Number(body.price)
    if (name.length < 2) return NextResponse.json({ error: "Product name is required." }, { status: 400 })
    if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Enter a valid price." }, { status: 400 })

    const stockQty = Math.max(0, Math.trunc(Number(body.stockQty ?? 0)) || 0)
    const lowStockThreshold = Math.max(0, Math.trunc(Number(body.lowStockThreshold ?? 5)) || 5)
    const stockStatus = STOCK_STATUSES.includes(body.stockStatus)
      ? body.stockStatus
      : deriveStockStatus(stockQty, lowStockThreshold)

    let categoryId = body.categoryId ?? null
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } })
      if (!cat) categoryId = null
    }

    const sku = String(body.sku ?? "").trim() || `SPH-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`
    const clash = await db.product.findUnique({ where: { sku } })
    if (clash) return NextResponse.json({ error: `SKU ${sku} already exists.` }, { status: 409 })

    const product = await db.product.create({
      data: {
        name,
        sku,
        categoryId,
        brand: body.brand ? String(body.brand).trim() : null,
        packSize: body.packSize ? String(body.packSize).trim() : null,
        price,
        compareAtPrice: body.compareAtPrice != null && body.compareAtPrice !== "" ? Number(body.compareAtPrice) : null,
        stockStatus,
        stockQty,
        lowStockThreshold,
        requiresPrescription: Boolean(body.requiresPrescription),
        description: String(body.description ?? "").trim() || "",
        usageInfo: body.usageInfo ? String(body.usageInfo).trim() : null,
        warnings: body.warnings ? String(body.warnings).trim() : null,
        image: body.image ? String(body.image).trim() : "💊",
        active: body.active !== false,
      },
      include: { category: true },
    })
    await audit(session.staffName ?? "Staff", session.staffRole, "PRODUCT_CREATED", "Product", product.id, `${product.name} @ KSh ${product.price}`)
    return NextResponse.json(toProductDTO(product))
  } catch {
    return NextResponse.json({ error: "Could not create the product." }, { status: 500 })
  }
}
