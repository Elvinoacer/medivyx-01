import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { attachRatings, toProductDTO } from "@/lib/dto"
import { audit } from "@/lib/notify"
import { getSession, requireStaff } from "@/lib/session"
import { STOCK_STATUSES, type StockStatus } from "@/lib/constants"
import { managedImage } from "@/lib/security/service"
import { randomBytes } from "crypto"
import { rejectOversizedRequest } from "@/lib/security/request"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const category = url.searchParams.get("category")?.trim() ?? ""
  const rx = url.searchParams.get("rx") ?? "any"
  const availability = url.searchParams.get("availability") ?? "any"
  const stockStatus = url.searchParams.get("stockStatus") ?? ""
  const sort = url.searchParams.get("sort") ?? "popular"
  const adminView = url.searchParams.get("admin") === "yes"
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "12", 10) || 12))
  const ids = [...new Set((url.searchParams.get("ids") || "").split(",").filter(Boolean))].slice(0, 50)

  if (adminView) {
    const session = await getSession()
    if (!session?.staffId || !["ADMIN", "PHARMACIST", "STAFF"].includes(session.staffRole ?? "")) {
      return NextResponse.json({ error: "Staff access required." }, { status: 403 })
    }
  }

  const where: Record<string, unknown> = adminView ? {} : { active: true }
  if (ids.length) where.id = { in: ids }
  if (search) {
    // PostgreSQL's default text comparison can be case-sensitive depending on
    // collation. Always search case-insensitively and split multi-word queries
    // so "PANADOL extra", "Panadol EXTRA" and "panadol extra" behave alike.
    const searchTerms = search
      .toLocaleLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, "").trim())
      .filter(Boolean)

    where.AND = searchTerms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { brand: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { packSize: { contains: term, mode: "insensitive" } },
        { usageInfo: { contains: term, mode: "insensitive" } },
        { warnings: { contains: term, mode: "insensitive" } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    }))
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
  if (adminView && STOCK_STATUSES.includes(stockStatus as StockStatus)) where.stockStatus = stockStatus

  let orderBy: Record<string, string> = { createdAt: "desc" }
  if (sort === "price-asc") orderBy = { price: "asc" }
  if (sort === "price-desc") orderBy = { price: "desc" }
  if (sort === "name") orderBy = { name: "asc" }
  if (sort === "name-desc") orderBy = { name: "desc" }
  if (sort === "newest") orderBy = { createdAt: "desc" }
  if (sort === "oldest") orderBy = { createdAt: "asc" }
  if (sort === "stock-asc") orderBy = { stockQty: "asc" }
  if (sort === "stock-desc") orderBy = { stockQty: "desc" }
  if (sort === "popular") {
    const [total, ranked] = await Promise.all([
      db.product.count({ where }),
      db.orderItem.groupBy({ by: ["productId"], where: { productId: { not: null } }, _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 500 }),
    ])
    const score = new Map(ranked.map((row, index) => [row.productId, index]))
    const popularIds = ranked.map((row) => row.productId).filter((id): id is string => Boolean(id))
    const rankedProducts = popularIds.length ? await db.product.findMany({ where: { AND: [where, { id: { in: popularIds } }] }, include: { category: true } }) : []
    rankedProducts.sort((a, b) => (score.get(a.id) ?? 501) - (score.get(b.id) ?? 501))
    const offset = (page - 1) * pageSize
    let products = rankedProducts.slice(offset, offset + pageSize)
    if (products.length < pageSize) {
      const fallbackSkip = Math.max(0, offset - rankedProducts.length)
      const fallback = await db.product.findMany({ where: { AND: [where, { id: { notIn: popularIds } }] }, include: { category: true }, orderBy: { createdAt: "desc" }, skip: fallbackSkip, take: pageSize - products.length })
      products = [...products, ...fallback]
    }
    const withRatings = await attachRatings(products)
    return NextResponse.json({ items: withRatings.map(toProductDTO), total, page, pageSize }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } })
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
  const oversized = rejectOversizedRequest(request, 32_768)
  if (oversized) return oversized
  try {
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const price = Number(body.price)
    if (name.length < 2 || name.length > 160) return NextResponse.json({ error: "Product name must be 2–160 characters." }, { status: 400 })
    if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return NextResponse.json({ error: "Enter a valid price." }, { status: 400 })

    const rawStockQty = Number(body.stockQty ?? 0)
    const rawThreshold = Number(body.lowStockThreshold ?? 5)
    if (!Number.isSafeInteger(rawStockQty) || rawStockQty < 0 || !Number.isSafeInteger(rawThreshold) || rawThreshold < 0) return NextResponse.json({ error: "Stock values must be non-negative whole numbers." }, { status: 400 })
    const stockQty = rawStockQty
    const lowStockThreshold = rawThreshold
    const stockStatus = STOCK_STATUSES.includes(body.stockStatus)
      ? body.stockStatus
      : deriveStockStatus(stockQty, lowStockThreshold)

    let categoryId = body.categoryId ?? null
    if (categoryId) {
      const cat = await db.category.findUnique({ where: { id: categoryId } })
      if (!cat) categoryId = null
    }

    const sku = String(body.sku ?? "").trim().toUpperCase() || `SPH-${randomBytes(5).toString("hex").toUpperCase()}`
    if (!/^[A-Z0-9._-]{3,64}$/.test(sku)) return NextResponse.json({ error: "SKU format is invalid." }, { status: 400 })
    const clash = await db.product.findUnique({ where: { sku } })
    if (clash) return NextResponse.json({ error: `SKU ${sku} already exists.` }, { status: 409 })

    const compareAtPrice = body.compareAtPrice != null && body.compareAtPrice !== "" ? Number(body.compareAtPrice) : null
    if (compareAtPrice != null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= price)) return NextResponse.json({ error: "Compare-at price must be greater than the sale price." }, { status: 400 })
    if (body.requiresPrescription !== undefined && typeof body.requiresPrescription !== "boolean" || body.active !== undefined && typeof body.active !== "boolean") return NextResponse.json({ error: "Product flags must be true or false." }, { status: 400 })
    const image = body.image ? managedImage(body.image) : null
    if (body.image && !image) return NextResponse.json({ error: "Product image must be an owned upload or site image." }, { status: 400 })
    const product = await db.product.create({
      data: {
        name,
        sku,
        categoryId,
        brand: body.brand ? String(body.brand).trim() : null,
        packSize: body.packSize ? String(body.packSize).trim() : null,
        price,
        compareAtPrice,
        stockStatus,
        stockQty,
        lowStockThreshold,
        requiresPrescription: body.requiresPrescription === true,
        description: String(body.description ?? "").trim().slice(0, 5_000),
        usageInfo: body.usageInfo ? String(body.usageInfo).trim() : null,
        warnings: body.warnings ? String(body.warnings).trim() : null,
        image,
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
