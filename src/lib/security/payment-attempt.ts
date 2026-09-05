import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { sameMoney } from "@/lib/security/payment"

// Reserve before network I/O. Serializable isolation prevents concurrent methods
// from both creating an active attempt. Uncertain attempts require reconciliation.
export async function reservePaymentAttempt(input: {
  kind: "order" | "service"; entityId: string; key: string; provider: string;
  method: string; staffRequest?: boolean; amount: Prisma.Decimal; phone?: string
}) {
  return db.$transaction(async (tx) => {
    const previous = input.kind === "order"
      ? await tx.payment.findUnique({ where: { idempotencyKey: input.key } })
      : await tx.servicePayment.findUnique({ where: { idempotencyKey: input.key } })
    if (previous) throw new Error("PAYMENT_ATTEMPT_EXISTS")
    const active = input.kind === "order"
      ? await tx.payment.findFirst({ where: { orderId: input.entityId, status: { in: ["PENDING", "PROCESSING", "SUCCESS", "REFUND_PENDING", "REFUNDED"] }, provider: { in: ["MPESA", "INTASEND", "CASH"] } } })
      : await tx.servicePayment.findFirst({ where: { bookingId: input.entityId, status: { in: ["PENDING", "PROCESSING", "SUCCESS", "REFUND_PENDING", "REFUNDED"] }, provider: { in: ["MPESA", "INTASEND", "CASH"] } } })
    if (active) throw new Error("PAYMENT_ATTEMPT_EXISTS")
    if (input.kind === "order") {
      const order = await tx.order.findUnique({ where: { id: input.entityId }, include: { prescriptions: true } })
      if (!order || !(input.staffRequest ? ["PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED", "AWAITING_PAYMENT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"] : ["AWAITING_PAYMENT"]).includes(order.status) || !sameMoney(order.total, input.amount) || order.prescriptions.some(rx => !["APPROVED", "PARTIALLY_APPROVED"].includes(rx.status))) throw new Error("PAYMENT_NOT_PAYABLE")
    } else {
      const booking = await tx.serviceBooking.findUnique({ where: { id: input.entityId } })
      if (!booking || !["PENDING", "CONFIRMED", "RESCHEDULED", "ARRIVED", "IN_PROGRESS"].includes(booking.status) || booking.paymentStatus === "PAID" || !sameMoney(booking.price, input.amount)) throw new Error("PAYMENT_NOT_PAYABLE")
    }
    const data = { provider: input.provider, method: input.method, amount: input.amount, phone: input.phone, currency: "KES", idempotencyKey: input.key, status: "PROCESSING" }
    return input.kind === "order"
      ? tx.payment.create({ data: { ...data, orderId: input.entityId } })
      : tx.servicePayment.create({ data: { ...data, bookingId: input.entityId } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 5000 })
}
