import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { pointsForAmount } from "@/lib/constants"
import { db } from "@/lib/db"
import { getIntaSendInvoice, verifyIntaSendWebhook } from "@/lib/intasend/client"
import { notifyCustomer, notifyServiceBooking } from "@/lib/notify"
import { paymentMatchesExpected } from "@/lib/security/payment"

export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyIntaSendWebhook(raw, request.headers)) return NextResponse.json({ error: "Invalid webhook authentication." }, { status: 401 })
  let body: Record<string, unknown>
  try { body = JSON.parse(raw) as Record<string, unknown> } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) }
  const invoiceId = String(body.invoice_id || body.tracking_id || "")
  if (!invoiceId) return NextResponse.json({ error: "Missing invoice ID." }, { status: 400 })

  try {
    const invoice = await getIntaSendInvoice(invoiceId)
    const eventId = `intasend:${String(body.event_id || `${invoice.id}:${invoice.state}:${invoice.trackingId || ""}`)}`
    const payloadHash = createHash("sha256").update(raw).digest("hex")
    const payment = await db.payment.findFirst({ where: { provider: "INTASEND", OR: [{ checkoutRequestId: invoice.id }, { checkoutRequestId: invoiceId }, { providerReference: invoice.id }] }, include: { order: true } })
    if (payment) {
      if (invoice.apiRef !== payment.order.reference || !paymentMatchesExpected({ expectedAmount: payment.amount, actualAmount: invoice.amount, expectedCurrency: payment.currency, actualCurrency: invoice.currency, receipt: invoice.id })) {
        return NextResponse.json({ error: "Payment verification mismatch." }, { status: 409 })
      }
      const priorEvent = await db.paymentWebhookEvent.findUnique({ where: { eventId } })
      if (priorEvent && (priorEvent.payloadHash !== payloadHash || priorEvent.paymentId !== payment.id)) return NextResponse.json({ error: "Conflicting webhook replay." }, { status: 409 })
      if (priorEvent) return NextResponse.json({ ok: true })
      let awarded = 0
      let completed = false
      await db.$transaction(async (tx) => {
        const seen = await tx.paymentWebhookEvent.findUnique({ where: { eventId } })
        if (seen) return
        await tx.paymentWebhookEvent.create({ data: { provider: "INTASEND", eventId, payloadHash, paymentId: payment.id } })
        if (invoice.state === "COMPLETE") {
          const changed = await tx.payment.updateMany({ where: { id: payment.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS", providerReference: invoice.id, failureReason: null } })
          if (changed.count === 0) return
          completed = true
          const moved = await tx.order.updateMany({ where: { id: payment.orderId, status: { in: ["AWAITING_PAYMENT", "AVAILABILITY_CONFIRMED", "PRESCRIPTION_VERIFIED"] } }, data: { status: "PAID", version: { increment: 1 } } })
          if (moved.count) await tx.orderStatusHistory.create({ data: { orderId: payment.orderId, status: "PAID", actor: "System", note: `IntaSend payment confirmed (${invoice.id})` } })
          if (payment.order.userId) {
            awarded = pointsForAmount(Number(payment.amount))
            if (awarded > 0) {
              await tx.loyaltyLedger.create({ data: { eventKey: `earn:${payment.orderId}`, userId: payment.order.userId, orderId: payment.orderId, delta: awarded, reason: "PAYMENT_CAPTURED" } })
              await tx.user.update({ where: { id: payment.order.userId }, data: { loyaltyPoints: { increment: awarded } } })
              await tx.order.update({ where: { id: payment.orderId }, data: { pointsEarned: awarded } })
            }
          }
        } else if (["FAILED", "CANCELLED"].includes(invoice.state)) {
          await tx.payment.updateMany({ where: { id: payment.id, status: { not: "SUCCESS" } }, data: { status: "FAILED", failureReason: "Card payment was not completed" } })
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      if (completed) await notifyCustomer(payment.order.userId, "PAYMENT", `Payment received — order ${payment.order.reference}`, `Card payment of KSh ${Number(payment.amount).toLocaleString()} confirmed.${awarded ? ` You earned ${awarded} Sphere Points.` : ""}`, "IN_APP", { link: `/orders/${payment.orderId}`, metadata: { orderId: payment.orderId, providerReference: invoice.id } })
      return NextResponse.json({ ok: true })
    }

    const servicePayment = await db.servicePayment.findFirst({ where: { provider: "INTASEND", OR: [{ checkoutRequestId: invoice.id }, { checkoutRequestId: invoiceId }, { providerReference: invoice.id }] }, include: { booking: { include: { user: true, service: true } } } })
    if (!servicePayment) return NextResponse.json({ error: "Unknown payment attempt." }, { status: 404 })
    if (invoice.apiRef !== servicePayment.booking.reference || !paymentMatchesExpected({ expectedAmount: servicePayment.amount, actualAmount: invoice.amount, expectedCurrency: servicePayment.currency, actualCurrency: invoice.currency, receipt: invoice.id })) return NextResponse.json({ error: "Payment verification mismatch." }, { status: 409 })
    const priorEvent = await db.paymentWebhookEvent.findUnique({ where: { eventId } })
    if (priorEvent && (priorEvent.payloadHash !== payloadHash || priorEvent.servicePaymentId !== servicePayment.id)) return NextResponse.json({ error: "Conflicting webhook replay." }, { status: 409 })
    if (priorEvent) return NextResponse.json({ ok: true })
    let serviceCompleted = false
    await db.$transaction(async (tx) => {
      if (await tx.paymentWebhookEvent.findUnique({ where: { eventId } })) return
      await tx.paymentWebhookEvent.create({ data: { provider: "INTASEND", eventId, payloadHash, servicePaymentId: servicePayment.id } })
      if (invoice.state === "COMPLETE") {
        const changed = await tx.servicePayment.updateMany({ where: { id: servicePayment.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS", providerReference: invoice.id, failureReason: null } })
        if (changed.count) {
          serviceCompleted = true
          await tx.serviceBooking.update({ where: { id: servicePayment.bookingId }, data: { paymentStatus: "PAID" } })
        }
      } else if (["FAILED", "CANCELLED"].includes(invoice.state)) await tx.servicePayment.updateMany({ where: { id: servicePayment.id, status: { not: "SUCCESS" } }, data: { status: "FAILED", failureReason: "Card payment was not completed" } })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    if (serviceCompleted) await notifyServiceBooking({ userId: servicePayment.booking.userId, customerName: servicePayment.booking.user.name, customerEmail: servicePayment.booking.user.email, reference: servicePayment.booking.reference, serviceName: servicePayment.booking.service.name, status: "Payment received", message: `Your card payment of KSh ${Number(servicePayment.amount).toLocaleString()} was received.`, start: servicePayment.booking.scheduledStart, end: servicePayment.booking.scheduledEnd, bookingId: servicePayment.bookingId, event: "SERVICE_PAYMENT_SUCCESS" })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Webhook verification is temporarily unavailable." }, { status: 503 })
  }
}
