import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { DISPATCH_STATUSES, LOYALTY } from "@/lib/constants"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { newOpaqueToken, orderReference, pickupCode, tokenHash } from "@/lib/hash"
import { redemptionQuote } from "@/lib/loyalty"
import { notifyCustomer, notifyStaff } from "@/lib/notify"
import { money } from "@/lib/security/payment"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"
import { getSession, requireStaff } from "@/lib/session"
import { computeDeliveryFee, getSettings } from "@/lib/settings"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const normalizePhone = (raw: string) => { const match = PHONE_RE.exec(raw.replace(/\s+/g, "")); return match ? `+254${match[1]}` : null }

function pageSize(url: URL, fallback = 50): number { return Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || fallback)) }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const scope = url.searchParams.get("scope")
  const take = pageSize(url)
  if (scope === "all") {
    const { error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
    if (error) return error
    const status = url.searchParams.get("status")?.trim()
    const type = url.searchParams.get("type")?.trim()
    const search = url.searchParams.get("search")?.trim().slice(0, 80)
    const orders = await db.order.findMany({ where: { ...(status ? { status } : {}), ...(type ? { type } : {}), ...(search ? { OR: [{ reference: { contains: search.toUpperCase() } }, { guestName: { contains: search, mode: "insensitive" } }, { guestPhone: { contains: search } }] } : {}) }, include: ORDER_INCLUDE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take })
    return NextResponse.json(orders.map(toOrderDTO), { headers: { "Cache-Control": "private, no-store" } })
  }
  if (scope === "dispatch") {
    const { error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
    if (error) return error
    const orders = await db.order.findMany({ where: { fulfillment: "DELIVERY", status: { in: DISPATCH_STATUSES } }, include: ORDER_INCLUDE, orderBy: [{ riderId: "asc" }, { createdAt: "asc" }], take })
    return NextResponse.json(orders.map(toOrderDTO), { headers: { "Cache-Control": "private, no-store" } })
  }
  if (scope === "rider") {
    const { session, error } = await requireStaff(["RIDER"])
    if (error) return error
    const orders = await db.order.findMany({ where: { riderId: session.staffId, fulfillment: "DELIVERY", status: { in: DISPATCH_STATUSES } }, include: ORDER_INCLUDE, orderBy: { createdAt: "asc" }, take })
    return NextResponse.json(orders.map(toOrderDTO), { headers: { "Cache-Control": "private, no-store" } })
  }
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: "Please sign in to view your orders." }, { status: 401 })
  const orders = await db.order.findMany({ where: { userId: session.userId }, include: ORDER_INCLUDE, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take })
  return NextResponse.json(orders.map(toOrderDTO), { headers: { "Cache-Control": "private, no-store" } })
}

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 64 * 1024)
    if (tooLarge) return tooLarge
    const limited = await enforceRateLimit(request, "order-create", 12, 15 * 60 * 1000)
    if (limited) return limited
    const body = await request.json()
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length || rawItems.length > 50) return NextResponse.json({ error: "Your cart must contain between 1 and 50 items." }, { status: 400 })
    const requested = new Map<string, number>()
    for (const item of rawItems) {
      const id = String(item?.productId || "")
      const qty = Number(item?.qty)
      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 99) return NextResponse.json({ error: "A cart quantity is invalid." }, { status: 400 })
      requested.set(id, (requested.get(id) || 0) + qty)
    }
    if ([...requested.values()].some((qty) => qty > 99)) return NextResponse.json({ error: "A product quantity exceeds the order limit." }, { status: 400 })
    const products = await db.product.findMany({ where: { id: { in: [...requested.keys()] } } })
    if (products.length !== requested.size) return NextResponse.json({ error: "A product no longer exists." }, { status: 409 })
    const lines = products.map((product) => ({ product, qty: requested.get(product.id)! }))
    for (const { product, qty } of lines) if (!product.active || product.stockStatus === "DISCONTINUED" || product.stockQty < qty) return NextResponse.json({ error: `${product.name} does not have enough stock.` }, { status: 409 })

    const session = await getSession()
    const userId = session?.role === "CUSTOMER" ? session.userId : null
    let guestName: string | null = null, guestPhone: string | null = null, guestEmail: string | null = null, guestAccessToken: string | null = null
    if (!userId) {
      guestName = String(body.customer?.name || "").trim().slice(0, 100)
      guestPhone = normalizePhone(String(body.customer?.phone || ""))
      guestEmail = body.customer?.email ? String(body.customer.email).trim().toLowerCase() : null
      if (guestName.length < 2 || !guestPhone || (guestEmail && !EMAIL_RE.test(guestEmail))) return NextResponse.json({ error: "Enter valid guest contact details." }, { status: 400 })
      guestAccessToken = newOpaqueToken()
    }
    const hasRx = lines.some(({ product }) => product.requiresPrescription)
    const rxIds: string[] = Array.isArray(body.prescriptionIds) ? [...new Set((body.prescriptionIds as unknown[]).map(String))] : []
    if (hasRx) {
      if (!userId) return NextResponse.json({ error: "Prescription items require a verified account." }, { status: 401 })
      const owned = await db.prescription.findMany({ where: { id: { in: rxIds }, userId, orderId: null, deletedAt: null } })
      if (!rxIds.length || owned.length !== rxIds.length) return NextResponse.json({ error: "Upload an unused prescription from your account." }, { status: 400 })
    }

    const fulfillment = body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP"
    const paymentMethod = ["MPESA", "CARD", "CASH", "LATER"].includes(body.paymentMethod) ? body.paymentMethod : "CASH"
    const settings = await getSettings()
    let deliveryAddress: string | null = null, deliveryArea: string | null = null, deliveryNotes: string | null = null
    let latitude: number | null = null, longitude: number | null = null
    if (fulfillment === "DELIVERY" && userId && body.addressId) {
      const address = await db.address.findFirst({ where: { id: String(body.addressId), userId } })
      if (address) { deliveryAddress = address.text; deliveryArea = address.area; deliveryNotes = address.notes; latitude = address.latitude; longitude = address.longitude }
    }
    if (fulfillment === "DELIVERY" && !deliveryAddress) {
      deliveryAddress = String(body.deliveryAddress || "").trim().slice(0, 300) || null
      deliveryArea = body.deliveryArea ? String(body.deliveryArea).trim().slice(0, 100) : null
      deliveryNotes = body.deliveryNotes ? String(body.deliveryNotes).trim().slice(0, 500) : null
      latitude = body.deliveryLatitude == null ? null : Number(body.deliveryLatitude)
      longitude = body.deliveryLongitude == null ? null : Number(body.deliveryLongitude)
    }
    if (fulfillment === "DELIVERY" && !deliveryAddress) return NextResponse.json({ error: "Enter the delivery address." }, { status: 400 })
    if (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) return NextResponse.json({ error: "Invalid delivery latitude." }, { status: 400 })
    if (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return NextResponse.json({ error: "Invalid delivery longitude." }, { status: 400 })

    const subtotal = money(lines.reduce((sum, line) => sum + Number(line.product.price) * line.qty, 0))
    const deliveryFee = fulfillment === "DELIVERY" ? money(computeDeliveryFee(deliveryArea, settings.delivery, subtotal, latitude, longitude)) : 0
    let promotion: Awaited<ReturnType<typeof db.promotion.findUnique>> = null
    const code = body.promotionCode ? String(body.promotionCode).trim().toUpperCase() : ""
    if (code) {
      promotion = await db.promotion.findUnique({ where: { code } })
      const now = new Date()
      if (!promotion?.active || !promotion.discountPct || promotion.startsAt && promotion.startsAt > now || promotion.endsAt && promotion.endsAt < now || promotion.minimumSpend && subtotal < Number(promotion.minimumSpend)) return NextResponse.json({ error: "This promotion is unavailable for the order." }, { status: 400 })
    }
    const discountAmount = promotion ? money(Math.min(subtotal, subtotal * promotion.discountPct! / 100)) : 0
    let pointsRedeemed = 0
    if (body.redeemPoints && userId) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { loyaltyPoints: true } })
      pointsRedeemed = redemptionQuote(subtotal - discountAmount, user?.loyaltyPoints || 0).points
    }
    const total = money(Math.max(0, subtotal - discountAmount + deliveryFee - pointsRedeemed * LOYALTY.pointValue))
    const initialStatus = hasRx ? "UNDER_REVIEW" : paymentMethod === "MPESA" || paymentMethod === "CARD" ? "AWAITING_PAYMENT" : "RECEIVED"
    const type = hasRx ? (lines.every(({ product }) => product.requiresPrescription) ? "PRESCRIPTION" : "MIXED") : body.reservation ? "RESERVATION" : "OTC"

    const order = await db.$transaction(async (tx) => {
      if (promotion) {
        if (promotion.maxUses != null && await tx.promotionRedemption.count({ where: { promotionId: promotion.id } }) >= promotion.maxUses) throw new Error("PROMOTION_LIMIT")
        if (userId && promotion.perUserLimit != null && await tx.promotionRedemption.count({ where: { promotionId: promotion.id, userId } }) >= promotion.perUserLimit) throw new Error("PROMOTION_LIMIT")
      }
      for (const { product, qty } of lines) {
        const reserved = await tx.product.updateMany({ where: { id: product.id, active: true, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } })
        if (reserved.count !== 1) throw new Error(`OUT_OF_STOCK:${product.name}`)
      }
      if (pointsRedeemed && userId) {
        const debited = await tx.user.updateMany({ where: { id: userId, loyaltyPoints: { gte: pointsRedeemed } }, data: { loyaltyPoints: { decrement: pointsRedeemed } } })
        if (debited.count !== 1) throw new Error("POINTS_CHANGED")
      }
      const created = await tx.order.create({ data: {
        reference: orderReference(), userId, guestName, guestPhone, guestEmail,
        guestAccessTokenHash: guestAccessToken ? tokenHash(guestAccessToken) : null,
        guestAccessExpiresAt: guestAccessToken ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        type, status: initialStatus, fulfillment, deliveryAddress, deliveryArea, deliveryNotes,
        deliveryLatitude: latitude, deliveryLongitude: longitude, deliveryFee, subtotal, discountAmount,
        promotionCode: promotion?.code || null, total, pointsRedeemed,
        notes: body.notes ? String(body.notes).trim().slice(0, 1000) : null,
        pickupCode: fulfillment === "PICKUP" ? pickupCode() : null,
        inventoryReservedAt: new Date(),
        items: { create: lines.map(({ product, qty }) => ({ productId: product.id, name: product.name, price: product.price, qty, requiresPrescription: product.requiresPrescription, lineTotal: money(Number(product.price) * qty) })) },
        statusHistory: { create: { status: initialStatus, actor: "System", note: hasRx ? "Prescription queued for pharmacist review" : "Order received" } },
      }, include: ORDER_INCLUDE })
      if (hasRx) await tx.prescription.updateMany({ where: { id: { in: rxIds }, userId, orderId: null }, data: { orderId: created.id } })
      if (promotion) await tx.promotionRedemption.create({ data: { promotionId: promotion.id, orderId: created.id, userId } })
      if (pointsRedeemed && userId) await tx.loyaltyLedger.create({ data: { eventKey: `redeem:${created.id}`, userId, orderId: created.id, delta: -pointsRedeemed, reason: "ORDER_REDEMPTION" } })
      return created
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    const orderLink = `/orders/${order.id}${guestAccessToken ? `#access=${guestAccessToken}` : ""}`
    await notifyCustomer(userId, "ORDER_STATUS", `Order ${order.reference} received`, `We received your order ${order.reference} (KSh ${total.toLocaleString()}).`, "IN_APP", { link: orderLink, metadata: { orderId: order.id }, email: (userId ? (await db.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email : guestEmail) ? { to: (userId ? (await db.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email : guestEmail)!, subject: `Order ${order.reference} received`, html: `<p>Your order <strong>${order.reference}</strong> has been received.</p><p><a href="${orderLink}">Track your order</a></p>`, text: `Order ${order.reference} received. Track: ${orderLink}` } : undefined })
    await notifyStaff({ roles: hasRx ? ["ADMIN", "PHARMACIST"] : ["ADMIN", "PHARMACIST", "STAFF"], event: hasRx ? "NEW_PRESCRIPTION_ORDER" : "NEW_ORDER", title: `New order: ${order.reference}`, message: `A ${fulfillment.toLowerCase()} order for KSh ${total.toLocaleString()} was received.`, link: hasRx ? "/admin/prescriptions" : "/admin/orders" })
    return NextResponse.json({ ...toOrderDTO(order), ...(guestAccessToken ? { guestAccessToken } : {}) })
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message.startsWith("OUT_OF_STOCK:")) return NextResponse.json({ error: `${message.slice(13)} just went out of stock.` }, { status: 409 })
    if (message === "POINTS_CHANGED") return NextResponse.json({ error: "Your points balance changed. Review the total and try again." }, { status: 409 })
    if (message === "PROMOTION_LIMIT") return NextResponse.json({ error: "This promotion has reached its usage limit." }, { status: 409 })
    return NextResponse.json({ error: "Could not place your order. No stock or points were deducted." }, { status: 500 })
  }
}
