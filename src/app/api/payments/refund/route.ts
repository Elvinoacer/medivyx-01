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
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
      const orderUrl = `${appUrl}/#order-${order.id}`

      const customerUser = order.userId
        ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true } })
        : null
      const customerEmail = customerUser?.email

      await notifyCustomer(
        order.userId,
        "PAYMENT",
        `Refund issued — order ${order.reference}`,
        `KSh ${payment.amount.toLocaleString()} has been refunded to your original payment method (${payment.provider}).`,
        "IN_APP",
        {
          link: orderUrl,
          metadata: { orderId: order.id, reference: order.reference, amount: payment.amount, provider: payment.provider },
          email: customerEmail
            ? {
                to: customerEmail,
                subject: `Refund Issued: KSh ${payment.amount.toLocaleString()} for ${order.reference} — Sphere Pharmacy`,
                html: `<p>Hello ${customerUser?.name || "Customer"},</p><p>A refund of <strong>KSh ${payment.amount.toLocaleString()}</strong> has been issued for order <strong>${order.reference}</strong> back to your ${payment.provider} account.</p><p>Depending on your payment provider, funds typically reflect within a few minutes to 24 hours.</p>`,
                text: `Refund of KSh ${payment.amount.toLocaleString()} issued for order ${order.reference} via ${payment.provider}.`,
              }
            : undefined,
        }
      )
    }
    await audit(session.staffName ?? "Admin", session.staffRole, "PAYMENT_REFUNDED", "Payment", payment.id, `KSh ${payment.amount} (${payment.provider}) order ${order?.reference ?? "?"}`)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not process the refund." }, { status: 500 })
  }
}
