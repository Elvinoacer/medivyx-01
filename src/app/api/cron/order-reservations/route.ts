import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

const EXPIRABLE = ["RECEIVED", "UNDER_REVIEW", "PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED", "AWAITING_PAYMENT"]

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const minutes = Number(process.env.ORDER_RESERVATION_TTL_MINUTES)
  if (!Number.isSafeInteger(minutes) || minutes < 15 || minutes > 10_080) return NextResponse.json({ error: "Reservation expiry is not configured." }, { status: 503 })
  const cutoff = new Date(Date.now() - minutes * 60_000)
  const candidates = await db.order.findMany({ where: { status: { in: EXPIRABLE }, inventoryReservedAt: { lte: cutoff }, inventoryReleasedAt: null, payments: { none: { status: "SUCCESS" } } }, include: { items: true }, take: 100 })
  let released = 0
  for (const order of candidates) {
    try {
      await db.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({ where: { id: order.id, version: order.version, inventoryReleasedAt: null, status: { in: EXPIRABLE } }, data: { status: "CANCELLED", inventoryReleasedAt: new Date(), version: { increment: 1 } } })
        if (claim.count !== 1) return
        for (const item of order.items) if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.qty } } })
        if (order.userId && order.pointsRedeemed > 0) {
          await tx.loyaltyLedger.create({ data: { eventKey: `expire:${order.id}`, userId: order.userId, orderId: order.id, delta: order.pointsRedeemed, reason: "RESERVATION_EXPIRED" } })
          await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: order.pointsRedeemed } } })
        }
        await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED", failureReason: "Inventory reservation expired" } })
        await tx.orderStatusHistory.create({ data: { orderId: order.id, status: "CANCELLED", actor: "SYSTEM", note: "Inventory reservation expired before payment." } })
        released++
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch { /* another worker or request won the race */ }
  }
  return NextResponse.json({ ok: true, released })
}
