import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer, statusNotification } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { reversePointsForOrder } from "@/lib/loyalty"
import { ORDER_STATUSES, RIDER_ALLOWED_STATUSES, type OrderStatus } from "@/lib/constants"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = (await requireStaffRoute()) ?? (await getSessionSafe())
  // customers can view own orders; staff can view all; guests get 401 (checkout success page handles)
  const order = await db.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  const isStaff = session?.staffId
  const isOwner = session?.userId && order.userId === session.userId
  if (!isStaff && !isOwner) {
    // guests → 401 (sign-in prompt); signed-in but not the owner → 403 (wrong-account message)
    if (session?.userId) {
      return NextResponse.json(
        { error: "This order was placed from a different account or as a guest — sign in with those details, or contact us with the order reference." },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: "Please sign in to view this order." }, { status: 401 })
  }
  return NextResponse.json(toOrderDTO(order))
}

// PATCH — staff status workflow update (riders restricted to their own delivery orders)
export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff()
  if (error) return error
  const { id } = await params
  const order = await db.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  const actor = session.staffName ?? "Staff"

  // RIDER role: only delivery orders assigned to them, only delivery-progress statuses
  if (session.staffRole === "RIDER") {
    if (order.riderId !== session.staffId || order.fulfillment !== "DELIVERY") {
      return NextResponse.json({ error: "This delivery is not assigned to you." }, { status: 403 })
    }
  }

  try {
    const body = await request.json()
    const status = String(body.status ?? "") as OrderStatus
    const note = body.note ? String(body.note).trim() : undefined
    if (!ORDER_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Unknown order status." }, { status: 400 })
    }
    if (session.staffRole === "RIDER" && !RIDER_ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Riders can only mark orders out for delivery or delivered." }, { status: 403 })
    }
    if (order.status === status) {
      return NextResponse.json(toOrderDTO(order))
    }

    // Stock decrement once, when an order first moves into PREPARING or beyond
    const STOCK_DECREMENT_FROM: OrderStatus[] = ["PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED_PICKUP", "COMPLETED_DELIVERY"]
    const alreadyPrepared = order.statusHistory.some((h) => STOCK_DECREMENT_FROM.includes(h.status as OrderStatus))
    if (STOCK_DECREMENT_FROM.includes(status) && !alreadyPrepared) {
      for (const item of order.items) {
        if (!item.productId) continue
        const product = await db.product.findUnique({ where: { id: item.productId } })
        if (!product) continue
        const qty = Math.max(0, product.stockQty - item.qty)
        const stockStatus = qty <= 0 ? "OUT_OF_STOCK" : qty <= product.lowStockThreshold ? "LOW_STOCK" : "IN_STOCK"
        await db.product.update({ where: { id: product.id }, data: { stockQty: qty, stockStatus } })
        await audit(actor, session.staffRole, "STOCK_UPDATE", "Product", product.sku, `Order ${order.reference}: ${product.name} ${product.stockQty} → ${qty}`)
      }
    }

    // Refund side-effects
    if (status === "REFUNDED") {
      await db.payment.updateMany({ where: { orderId: order.id, status: "SUCCESS" }, data: { status: "REFUNDED" } })
    }

    // Loyalty: claw back earned points + return redeemed points on cancel/refund
    if (status === "REFUNDED" || status === "CANCELLED") {
      await reversePointsForOrder(order.id, actor)
    }

    await db.order.update({ where: { id: order.id }, data: { status } })
    await addStatusEvent(order.id, status, actor, note)
    await audit(actor, session.staffRole, `ORDER_STATUS_${status}`, "Order", order.reference, note ?? undefined)

    const { title, message } = statusNotification(status, order.reference)
    await notifyCustomer(order.userId, "ORDER_STATUS", title, message)
    if (order.userId) {
      // also model the WhatsApp/SMS channel so customers see multi-channel updates
      await notifyCustomer(order.userId, "ORDER_STATUS", title, message, "WHATSAPP")
    }

    const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
    return NextResponse.json(toOrderDTO(updated!))
  } catch {
    return NextResponse.json({ error: "Could not update the order status." }, { status: 500 })
  }
}

// small helpers to avoid import cycles
async function requireStaffRoute() {
  const { getSession } = await import("@/lib/session")
  const s = await getSession()
  return s?.staffId ? s : null
}
async function getSessionSafe() {
  const { getSession } = await import("@/lib/session")
  return getSession()
}
