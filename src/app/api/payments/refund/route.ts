import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
import { requireStaff } from "@/lib/session"

/** FR-7.7 — refund a captured payment (admin). */
export async function POST(request: Request) {
  const { session, error } = await requireStaff(["ADMIN"])
  if (error) return error
  try {
    const body = await request.json()
    const paymentId = String(body.paymentId ?? "")
    const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } })
    if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 })
    if (payment.status !== "SUCCESS") {
      return NextResponse.json({ error: "Only captured payments can be refunded." }, { status: 400 })
    }

    await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } })
    const order = payment.order
    if (order && !["REFUNDED", "CANCELLED"].includes(order.status)) {
      await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } })
      await addStatusEvent(order.id, "REFUNDED", session.staffName ?? "Admin", `KSh ${payment.amount} refunded via ${payment.provider}`)
      await notifyCustomer(order.userId, "PAYMENT", `Refund issued — order ${order.reference}`, `KSh ${payment.amount} has been refunded to your original payment method.`)
    }
    await audit(session.staffName ?? "Admin", session.staffRole, "PAYMENT_REFUNDED", "Payment", payment.id, `KSh ${payment.amount} (${payment.provider}) order ${order?.reference ?? "?"}`)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not process the refund." }, { status: 500 })
  }
}
