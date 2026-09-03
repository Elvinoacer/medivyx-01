import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { attachRatings, toProductDTO } from "@/lib/dto"
import { audit, notifyCustomer, notifyStaff } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { STOCK_STATUSES } from "@/lib/constants"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const product = await db.product.findUnique({ where: { id }, include: { category: true } })
  if (!product || !product.active) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 })
  }
  const [withRating] = await attachRatings([product])
  return NextResponse.json(toProductDTO(withRating))
}

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "PHARMACIST"])
  if (error) return error
  const { id } = await params
  const existing = await db.product.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Product not found." }, { status: 404 })
  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) data.name = String(body.name).trim()
    if (body.brand !== undefined) data.brand = body.brand ? String(body.brand).trim() : null
    if (body.packSize !== undefined) data.packSize = body.packSize ? String(body.packSize).trim() : null
    if (body.description !== undefined) data.description = String(body.description ?? "").trim()
    if (body.usageInfo !== undefined) data.usageInfo = body.usageInfo ? String(body.usageInfo).trim() : null
    if (body.warnings !== undefined) data.warnings = body.warnings ? String(body.warnings).trim() : null
    if (body.image !== undefined) data.image = body.image ? String(body.image).trim() : null
    if (body.requiresPrescription !== undefined) data.requiresPrescription = Boolean(body.requiresPrescription)
    if (body.categoryId !== undefined) {
      const cat = body.categoryId ? await db.category.findUnique({ where: { id: body.categoryId } }) : null
      data.categoryId = cat?.id ?? null
    }
    if (body.price !== undefined) {
      const price = Number(body.price)
      if (!Number.isFinite(price) || price < 0) return NextResponse.json({ error: "Enter a valid price." }, { status: 400 })
      data.price = price
    }
    if (body.compareAtPrice !== undefined) {
      data.compareAtPrice = body.compareAtPrice != null && body.compareAtPrice !== "" ? Number(body.compareAtPrice) : null
    }
    if (body.stockQty !== undefined) {
      const qty = Math.max(0, Math.trunc(Number(body.stockQty) || 0))
      data.stockQty = qty
      if (!body.stockStatus) {
        data.stockStatus = qty <= 0 ? "OUT_OF_STOCK" : qty <= existing.lowStockThreshold ? "LOW_STOCK" : "IN_STOCK"
      }
    }
    if (body.stockStatus !== undefined && STOCK_STATUSES.includes(body.stockStatus)) {
      data.stockStatus = body.stockStatus
      if (body.stockStatus === "OUT_OF_STOCK" && body.stockQty === undefined) data.stockQty = 0
      if (body.stockStatus === "DISCONTINUED") data.active = false
      if (body.stockStatus !== "DISCONTINUED" && body.active === undefined && !existing.active) data.active = true
    }
    if (body.active !== undefined) data.active = Boolean(body.active)

    const updated = await db.product.update({ where: { id }, data, include: { category: true } })

    // Back-in-stock alerts: notify pending watchers when the product becomes available again
    const becameAvailable =
      (existing.stockStatus === "OUT_OF_STOCK" || !existing.active) &&
      (updated.stockStatus === "IN_STOCK" || updated.stockStatus === "LOW_STOCK")
    if (becameAvailable) {
      const watchers = await db.productAlert.findMany({
        where: { productId: id, notifiedAt: null },
        include: { user: { select: { id: true, email: true, name: true } } },
      })
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
      const productUrl = `${appUrl}/#product-${updated.id}`
      const { backInStockTemplate } = await import("@/lib/email/templates")
      const emailTemplate = backInStockTemplate({
        productName: updated.name,
        price: updated.price,
        productUrl,
      })

      for (const w of watchers) {
        await notifyCustomer(
          w.userId,
          "STOCK_ALERT",
          `${updated.name} is back in stock!`,
          `${updated.name} is back in stock at Sphere Pharmacy (KSh ${updated.price.toLocaleString()}) — order it while it lasts.`,
          "IN_APP",
          {
            link: productUrl,
            metadata: { productId: updated.id, productName: updated.name, price: updated.price },
            email: w.user?.email
              ? {
                  to: w.user.email,
                  subject: emailTemplate.subject,
                  html: emailTemplate.html,
                  text: emailTemplate.text,
                }
              : undefined,
          }
        )
        await db.productAlert.update({ where: { id: w.id }, data: { notifiedAt: new Date() } })
      }
    }

    // Low stock / Out of stock staff alert
    const isLowOrOut =
      (updated.stockStatus === "LOW_STOCK" || updated.stockStatus === "OUT_OF_STOCK" || updated.stockQty <= updated.lowStockThreshold) &&
      (existing.stockStatus === "IN_STOCK" && existing.stockQty > existing.lowStockThreshold)
    if (isLowOrOut) {
      await notifyStaff({
        roles: ["ADMIN", "PHARMACIST", "STAFF"],
        event: "LOW_STOCK_ALERT",
        title: `Low Stock Alert: ${updated.name}`,
        message: `${updated.name} is running low on stock. Current quantity: ${updated.stockQty} units (threshold: ${updated.lowStockThreshold}).`,
        link: `${process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"}/#admin-catalogue`,
        details: {
          Product: updated.name,
          SKU: updated.sku,
          CurrentQty: updated.stockQty,
          Threshold: updated.lowStockThreshold,
          Status: updated.stockStatus,
        },
      })
    }

    if (data.price !== undefined && Number(data.price) !== existing.price) {
      await audit(
        session.staffName ?? "Staff", session.staffRole, "PRICE_UPDATE", "Product", existing.sku,
        `Price changed from KSh ${existing.price} to KSh ${data.price} (${existing.name})`
      )
    }
    if (data.stockQty !== undefined && Number(data.stockQty) !== existing.stockQty) {
      await audit(
        session.staffName ?? "Staff", session.staffRole, "STOCK_UPDATE", "Product", existing.sku,
        `Stock qty ${existing.stockQty} → ${data.stockQty} (${existing.name})`
      )
    }
    await audit(session.staffName ?? "Staff", session.staffRole, "PRODUCT_UPDATED", "Product", existing.sku, existing.name)
    const [withRating] = await attachRatings([updated])
    return NextResponse.json(toProductDTO(withRating))
  } catch {
    return NextResponse.json({ error: "Could not update the product." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN"])
  if (error) return error
  const { id } = await params
  const existing = await db.product.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Product not found." }, { status: 404 })
  try {
    // keep history: mark discontinued rather than hard delete when referenced by orders
    const referenced = await db.orderItem.count({ where: { productId: id } })
    if (referenced > 0) {
      await db.product.update({ where: { id }, data: { active: false, stockStatus: "DISCONTINUED" } })
      await audit(session.staffName ?? "Staff", session.staffRole, "PRODUCT_DISCONTINUED", "Product", existing.sku, `${existing.name} (kept for order history)`)
    } else {
      await db.product.delete({ where: { id } })
      await audit(session.staffName ?? "Staff", session.staffRole, "PRODUCT_DELETED", "Product", existing.sku, existing.name)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not remove the product." }, { status: 500 })
  }
}
