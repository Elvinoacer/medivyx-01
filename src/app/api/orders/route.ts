import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { orderReference, pickupCode } from "@/lib/hash"
import { addStatusEvent, notifyCustomer } from "@/lib/notify"
import { getSession, requireStaff } from "@/lib/session"
import { computeDeliveryFee, getSettings } from "@/lib/settings"
import { redemptionQuote } from "@/lib/loyalty"
import { DISPATCH_STATUSES, LOYALTY, TERMINAL_STATUSES, type OrderStatus } from "@/lib/constants"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/
function normalizePhone(raw: string): string | null {
  const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
  return m ? `+254${m[1]}` : null
}

// GET /api/orders               → customer's own orders
// GET /api/orders?scope=all     → staff: all orders (filters: status, type, search)
// GET /api/orders?scope=dispatch→ staff: delivery orders for the dispatch board
// GET /api/orders?scope=rider   → rider: deliveries assigned to me
export async function GET(request: Request) {
  const url = new URL(request.url)
  const scope = url.searchParams.get("scope")

  if (scope === "all") {
    const { error } = await requireStaff()
    if (error) return error
    const status = url.searchParams.get("status")?.trim() ?? ""
    const type = url.searchParams.get("type")?.trim() ?? ""
    const search = url.searchParams.get("search")?.trim() ?? ""

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (type) where.type = type
    if (search) {
      where.OR = [
        { reference: { contains: search.toUpperCase() } },
        { guestName: { contains: search } },
        { guestPhone: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { phone: { contains: search } } },
        { deliveryAddress: { contains: search } },
      ]
    }
    const orders = await db.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" }, take: 500 })
    return NextResponse.json(orders.map(toOrderDTO))
  }

  // dispatch board — delivery orders in dispatch-relevant statuses, unassigned first
  if (scope === "dispatch") {
    const { session, error } = await requireStaff()
    if (error) return error
    const orders = await db.order.findMany({
      where: { fulfillment: "DELIVERY", status: { in: DISPATCH_STATUSES } },
      include: ORDER_INCLUDE,
      orderBy: [{ riderId: "asc" }, { createdAt: "asc" }],
      take: 100,
    })
    return NextResponse.json(orders.map(toOrderDTO))
  }

  // rider board — only orders assigned to the signed-in rider
  if (scope === "rider") {
    const { session, error } = await requireStaff(["RIDER"])
    if (error) return error
    const orders = await db.order.findMany({
      where: { riderId: session!.staffId, status: { in: DISPATCH_STATUSES } },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(orders.map(toOrderDTO))
  }

  // customer scope
  const session = await getSession()
  if (!session || session.role !== "CUSTOMER" || !session.userId) {
    return NextResponse.json({ error: "Please sign in to view your orders." }, { status: 401 })
  }
  const orders = await db.order.findMany({ where: { userId: session.userId }, include: ORDER_INCLUDE, orderBy: { createdAt: "desc" } })
  return NextResponse.json(orders.map(toOrderDTO))
}

// POST /api/orders — create an order/reservation
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const session = await getSession()

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return NextResponse.json({ error: "Your cart is empty." }, { status: 400 })

    const fulfillment = body.fulfillment === "DELIVERY" ? "DELIVERY" : "PICKUP"
    const reservation = Boolean(body.reservation)
    const paymentMethod = ["MPESA", "CARD", "CASH", "LATER"].includes(body.paymentMethod) ? body.paymentMethod : "CASH"

    // resolve products server-side (never trust client prices)
    const productIds = items.map((i: { productId: string }) => String(i.productId))
    const products = await db.product.findMany({ where: { id: { in: productIds } } })
    const orderLines: { product: (typeof products)[number]; qty: number }[] = []
    for (const item of items) {
      const product = products.find((p) => p.id === String(item.productId))
      const qty = Math.max(1, Math.min(99, Math.trunc(Number(item.qty)) || 1))
      if (!product) return NextResponse.json({ error: "One of the products no longer exists." }, { status: 400 })
      if (!product.active || product.stockStatus === "DISCONTINUED") {
        return NextResponse.json({ error: `${product.name} is no longer available.` }, { status: 400 })
      }
      if (product.stockStatus === "OUT_OF_STOCK") {
        return NextResponse.json({ error: `${product.name} is out of stock. Remove it or order via WhatsApp to be notified.` }, { status: 400 })
      }
      orderLines.push({ product, qty })
    }

    const hasRx = orderLines.some((l) => l.product.requiresPrescription)

    // customer resolution
    let userId = session?.role === "CUSTOMER" ? session.userId : null
    let guestName: string | null = null
    let guestPhone: string | null = null

    if (!userId) {
      const name = String(body.customer?.name ?? "").trim()
      const phoneRaw = String(body.customer?.phone ?? "").trim()
      if (name.length < 2) return NextResponse.json({ error: "Enter your name for this order." }, { status: 400 })
      const phone = normalizePhone(phoneRaw)
      if (!phone) return NextResponse.json({ error: "Enter a valid phone number (e.g. 0712 345 678)." }, { status: 400 })
      guestName = name
      guestPhone = phone
    }

    // FR-2.2/FR-5.4: prescription items need an identifiable, contactable customer + uploaded rx
    if (hasRx) {
      if (!userId) {
        return NextResponse.json(
          { error: "Prescription items require an account. Create one (quick, phone OTP works) so our pharmacist can verify your prescription." },
          { status: 401 }
        )
      }
      const rxIds = Array.isArray(body.prescriptionIds) ? body.prescriptionIds.map(String) : []
      if (rxIds.length === 0) {
        return NextResponse.json({ error: "Upload a prescription for the prescription-only items before placing the order." }, { status: 400 })
      }
      const owned = await db.prescription.findMany({ where: { id: { in: rxIds }, userId } })
      if (owned.length !== rxIds.length) {
        return NextResponse.json({ error: "Some uploaded prescriptions could not be found on your account." }, { status: 400 })
      }
    }

    // delivery details + fee
    const settings = await getSettings()
    let deliveryAddress: string | null = null
    let deliveryArea: string | null = null
    let deliveryNotes: string | null = null
    let deliveryFee = 0

    if (fulfillment === "DELIVERY") {
      if (userId && body.addressId) {
        const addr = await db.address.findFirst({ where: { id: String(body.addressId), userId } })
        if (addr) {
          deliveryAddress = addr.text
          deliveryArea = addr.area
          deliveryNotes = addr.notes
        }
      }
      if (!deliveryAddress) {
        deliveryAddress = String(body.deliveryAddress ?? "").trim() || null
        deliveryArea = body.deliveryArea ? String(body.deliveryArea).trim() : null
        deliveryNotes = body.deliveryNotes ? String(body.deliveryNotes).trim() : null
      }
      if (!deliveryAddress) {
        return NextResponse.json({ error: "Enter the delivery address." }, { status: 400 })
      }
    }

    const subtotal = orderLines.reduce((s, l) => s + l.product.price * l.qty, 0)
    if (fulfillment === "DELIVERY") {
      deliveryFee = computeDeliveryFee(deliveryArea, settings.delivery, subtotal)
    }

    // ---- promo code (validated server-side; discounts apply to the subtotal) ----
    let discountAmount = 0
    let promotionCode: string | null = null
    const rawCode = body.promotionCode ? String(body.promotionCode).trim().toUpperCase() : ""
    if (rawCode) {
      const now = new Date()
      const promo = await db.promotion.findFirst({
        where: {
          code: rawCode,
          active: true,
          discountPct: { not: null },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      })
      if (!promo) {
        return NextResponse.json({ error: `Promo code ${rawCode} isn't valid or has expired.` }, { status: 400 })
      }
      discountAmount = Math.min(Math.round((subtotal * promo.discountPct!) / 100), subtotal)
      promotionCode = promo.code
    }

    const total = Math.max(0, subtotal - discountAmount + deliveryFee)

    // ---- Sphere Points redemption (signed-in customers only) ----
    let pointsRedeemed = 0
    if (body.redeemPoints && userId) {
      const user = await db.user.findUnique({ where: { id: userId } })
      const quote = redemptionQuote(Math.max(0, subtotal - discountAmount), user?.loyaltyPoints ?? 0)
      if (quote.points > 0) {
        pointsRedeemed = quote.points
        await db.user.update({ where: { id: userId }, data: { loyaltyPoints: { decrement: quote.points } } })
      }
    }
    const finalTotal = Math.max(0, total - pointsRedeemed * LOYALTY.pointValue)

    const type = hasRx ? (orderLines.every((l) => l.product.requiresPrescription) ? "PRESCRIPTION" : "MIXED") : reservation ? "RESERVATION" : "OTC"

    const reference = orderReference()
    const order = await db.order.create({
      data: {
        reference,
        userId,
        guestName,
        guestPhone,
        type,
        status: "RECEIVED",
        fulfillment,
        deliveryAddress,
        deliveryArea,
        deliveryNotes,
        deliveryFee,
        subtotal,
        discountAmount,
        promotionCode,
        total: finalTotal,
        pointsRedeemed,
        notes: body.notes ? String(body.notes).trim() : null,
        pickupCode: fulfillment === "PICKUP" ? pickupCode() : null,
        items: {
          create: orderLines.map((l) => ({
            productId: l.product.id,
            name: l.product.name,
            price: l.product.price,
            qty: l.qty,
            requiresPrescription: l.product.requiresPrescription,
            lineTotal: l.product.price * l.qty,
          })),
        },
      },
      include: ORDER_INCLUDE,
    })

    await addStatusEvent(order.id, "RECEIVED", "System", "Order received")

    // attach uploaded prescriptions to this order (authorised owner only, already validated)
    if (hasRx && userId) {
      const rxIds = (Array.isArray(body.prescriptionIds) ? body.prescriptionIds.map(String) : [])
      await db.prescription.updateMany({ where: { id: { in: rxIds }, userId }, data: { orderId: order.id } })
      const nextStatus: OrderStatus = "UNDER_REVIEW"
      await db.order.update({ where: { id: order.id }, data: { status: nextStatus } })
      await addStatusEvent(order.id, nextStatus, "System", "Prescription uploaded — queued for pharmacist review")
    }

    if (!hasRx) {
      // reservation & cash orders wait for staff availability confirmation;
      // online payments move the order to AWAITING_PAYMENT right away
      if (paymentMethod === "MPESA" || paymentMethod === "CARD") {
        await db.order.update({ where: { id: order.id }, data: { status: "AWAITING_PAYMENT" } })
        await addStatusEvent(order.id, "AWAITING_PAYMENT", "System", "Awaiting customer payment")
      }
    }

    await notifyCustomer(
      userId,
      "ORDER_STATUS",
      `Order ${reference} received`,
      reservation
        ? `We received your reservation ${reference}. We'll confirm availability shortly — pay and collect in store.`
        : `We received your order ${reference}. You'll get updates as it progresses.`
    )

    const finalOrder = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
    return NextResponse.json(toOrderDTO(finalOrder!))
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: "Could not place your order. Please try again." }, { status: 500 })
  }
}
