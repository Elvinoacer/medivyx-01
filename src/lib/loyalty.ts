import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { LOYALTY, pointsForAmount } from "@/lib/constants"
import type { LoyaltySummaryDTO } from "@/lib/types"

/**
 * Sphere Points loyalty engine.
 *
 * Earning: awarded once when an order's payment succeeds (pointsEarned acts as
 * the idempotency flag — a seeded order with pointsEarned > 0 has already been
 * credited). Refunds/cancellations claw back earned points and re-credit any
 * redeemed points.
 *
 * Redemption: at checkout, signed-in customers with ≥ LOYALTY.minRedeem points
 * can apply their balance — 1 point = LOYALTY.pointValue KSh, capped at
 * LOYALTY.maxRedeemPct% of the (post-promo) subtotal.
 */

/** Award points for a paid order (idempotent). Returns points awarded, or 0. */
export async function awardPointsForOrder(orderId: string): Promise<number> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order || order.pointsEarned !== 0 || !order.userId) return 0
    const netSpend = Math.max(0, Number(order.total) - order.pointsRedeemed * LOYALTY.pointValue)
    const points = pointsForAmount(netSpend)
    if (points <= 0) return 0
    const claimed = await tx.order.updateMany({ where: { id: order.id, pointsEarned: 0 }, data: { pointsEarned: points } })
    if (claimed.count !== 1) return 0
    await tx.loyaltyLedger.create({ data: { eventKey: `earn:${order.id}`, userId: order.userId, orderId: order.id, delta: points, reason: "ORDER_PAID" } })
    await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: points } } })
    return points
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

/** Refund/claw back points when an order is cancelled or refunded. */
export async function reversePointsForOrder(orderId: string, actor: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order?.userId || await tx.loyaltyLedger.findUnique({ where: { eventKey: `reverse:${orderId}` } })) return
    const user = await tx.user.findUnique({ where: { id: order.userId }, select: { loyaltyPoints: true } })
    const clawback = Math.min(order.pointsEarned, user?.loyaltyPoints ?? 0)
    const delta = order.pointsRedeemed - clawback
    await tx.loyaltyLedger.create({ data: { eventKey: `reverse:${orderId}`, userId: order.userId, orderId, delta, reason: "ORDER_REFUNDED" } })
    if (delta !== 0) await tx.user.update({ where: { id: order.userId }, data: { loyaltyPoints: { increment: delta } } })
    if (order.pointsEarned > 0 || order.pointsRedeemed > 0) await tx.auditLog.create({ data: { actor, actorRole: "SYSTEM", action: "LOYALTY_REVERSAL", entity: "Order", entityId: order.reference, details: `Clawed back ${clawback} earned pts, returned ${order.pointsRedeemed} redeemed pts` } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

/** Redemption quote for a customer + subtotal (post-promo). */
export function redemptionQuote(subtotal: number, balance: number): { points: number; value: number } {
  if (balance < LOYALTY.minRedeem) return { points: 0, value: 0 }
  const cap = Math.floor((subtotal * LOYALTY.maxRedeemPct) / 100 / LOYALTY.pointValue)
  const points = Math.min(balance, cap)
  if (points < LOYALTY.minRedeem) return { points: 0, value: 0 }
  return { points, value: points * LOYALTY.pointValue }
}

/** Account loyalty summary (balance + per-order history). */
export async function loyaltySummary(userId: string): Promise<LoyaltySummaryDTO> {
  const user = await db.user.findUnique({ where: { id: userId } })
  const orders = await db.order.findMany({
    where: { userId, OR: [{ pointsEarned: { gt: 0 } }, { pointsRedeemed: { gt: 0 } }] },
    orderBy: { createdAt: "desc" },
    take: 30,
  })
  const lifetimeEarned = orders.reduce((s, o) => s + o.pointsEarned, 0)
  const redeemedTotal = orders.reduce((s, o) => s + o.pointsRedeemed, 0)
  return {
    balance: user?.loyaltyPoints ?? 0,
    lifetimeEarned,
    pendingEarned: 0,
    redeemedTotal,
    pointValue: LOYALTY.pointValue,
    minRedeem: LOYALTY.minRedeem,
    maxRedeemPct: LOYALTY.maxRedeemPct,
    history: orders.map((o) => ({
      orderId: o.id,
      reference: o.reference,
      status: o.status as LoyaltySummaryDTO["history"][number]["status"],
      pointsEarned: o.pointsEarned,
      pointsRedeemed: o.pointsRedeemed,
      createdAt: o.createdAt.toISOString(),
    })),
  }
}
