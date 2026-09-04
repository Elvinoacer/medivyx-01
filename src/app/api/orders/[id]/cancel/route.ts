import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { audit, notifyCustomer, notifyStaff, statusNotification } from "@/lib/notify"
import { getSession } from "@/lib/session"
import { tokenHash } from "@/lib/hash"
import { escapeHtml, enforceRateLimit, rejectOversizedRequest, publicError } from "@/lib/security/request"

type Params = { params: Promise<{ id: string }> }
const CANCELLABLE = ["RECEIVED", "UNDER_REVIEW", "PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED", "AWAITING_PAYMENT"]

export async function POST(request: Request, { params }: Params) {
  const tooLarge = rejectOversizedRequest(request, 16_384)
  if (tooLarge) return tooLarge
  const limited = await enforceRateLimit(request, "order-cancel", 8, 15 * 60_000)
  if (limited) return limited

  try {
    const { id } = await params
    const session = await getSession()
    const order = await db.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

    const isOwner = Boolean(session?.userId && order.userId === session.userId)
    const isStaff = Boolean(session?.staffId && session.staffRole !== "RIDER")
    const rawToken = request.headers.get("x-order-access-token")?.trim()
    const isGuest = Boolean(rawToken && rawToken.length <= 256 && order.guestAccessTokenHash &&
      order.guestAccessExpiresAt && order.guestAccessExpiresAt > new Date() && tokenHash(rawToken) === order.guestAccessTokenHash)
    if (!isOwner && !isStaff && !isGuest) return NextResponse.json({ error: "You do not have access to cancel this order." }, { status: session ? 403 : 401 })
    if (!CANCELLABLE.includes(order.status)) return NextResponse.json({ error: "This order can no longer be cancelled online. Contact the pharmacy for help." }, { status: 409 })
    if (order.payments.some((payment) => payment.status === "SUCCESS")) {
      return NextResponse.json({ error: "A captured payment cannot be cancelled. An administrator must request and confirm a provider refund." }, { status: 409 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = body.reason ? String(body.reason).trim().slice(0, 500) : undefined
    const actor = isStaff ? (session?.staffName ?? "Staff") : (order.user?.name ?? order.guestName ?? "Customer")

    await db.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id: order.id, status: order.status, version: order.version, inventoryReleasedAt: null },
        data: { status: "CANCELLED", inventoryReleasedAt: new Date(), version: { increment: 1 } },
      })
      if (changed.count !== 1) throw new Error("ORDER_CONFLICT")

      if (order.inventoryReservedAt) {
        for (const item of order.items) {
          if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } })
        }
      }
      if (order.userId && order.pointsRedeemed > 0) {
        await tx.loyaltyLedger.create({ data: { eventKey: `cancel:${order.id}`, userId: order.userId, orderId: order.id, delta: order.pointsRedeemed, reason: "ORDER_CANCELLED" } })
        await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: order.pointsRedeemed } } })
      }
      await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED", failureReason: "Order cancelled before payment" } })
      await tx.orderStatusHistory.create({ data: { orderId: order.id, status: "CANCELLED", actor, note: reason ? `Cancelled: ${reason}` : "Cancelled by customer" } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    for (const item of order.items) {
      if (!item.productId) continue
      const product = await db.product.findUnique({ where: { id: item.productId }, select: { stockQty: true, lowStockThreshold: true } })
      if (product) await db.product.update({ where: { id: item.productId }, data: { stockStatus: product.stockQty <= 0 ? "OUT_OF_STOCK" : product.stockQty <= product.lowStockThreshold ? "LOW_STOCK" : "IN_STOCK" } })
    }

    await audit(actor, isStaff ? session?.staffRole ?? null : null, "ORDER_CANCELLED", "Order", order.reference, reason)
    const { title, message } = statusNotification("CANCELLED", order.reference)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
    const orderUrl = `${appUrl}/orders/${order.id}`
    const customer = order.userId ? await db.user.findUnique({ where: { id: order.userId }, select: { email: true } }) : null
    const emailAddress = customer?.email || order.guestEmail
    await notifyCustomer(order.userId, "ORDER_STATUS", title, message, "IN_APP", {
      link: orderUrl, metadata: { orderId: order.id, status: "CANCELLED", reference: order.reference },
      email: emailAddress ? {
        to: emailAddress, subject: `Order cancelled: ${order.reference}`,
        html: `<p>Your order <strong>${escapeHtml(order.reference)}</strong> has been cancelled.</p>${reason ? `<p>Reason: ${escapeHtml(reason)}</p>` : ""}<p>No captured payment was marked as refunded.</p>`,
        text: `Your order ${order.reference} has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
      } : undefined,
    })
    await notifyStaff({ roles: ["ADMIN", "PHARMACIST", "STAFF"], event: "ORDER_CANCELLED", title: `Order cancelled: ${order.reference}`, message: `Order ${order.reference} was cancelled by ${actor}.`, link: `${appUrl}/admin/orders` })

    const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
    return NextResponse.json(toOrderDTO(updated!))
  } catch (error) {
    if (error instanceof Error && (error.message === "ORDER_CONFLICT" || error.message.includes("Unique constraint"))) {
      return NextResponse.json({ error: "The order was already changed. Refresh and try again." }, { status: 409 })
    }
    return publicError("Could not cancel the order.")
  }
}
