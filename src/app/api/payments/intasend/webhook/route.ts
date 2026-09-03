import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE } from "@/lib/dto"
import { addStatusEvent, notifyCustomer, notifyServiceBooking, notifyStaff } from "@/lib/notify"
import { awardPointsForOrder } from "@/lib/loyalty"
import { paymentReceiptTemplate } from "@/lib/email/templates"

/**
 * IntaSend Webhook Handler.
 * Receives payment status updates for card and alternative payments.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const invoiceId = String(body.invoice_id || body.tracking_id || "")
    const state = String(body.state || "").toUpperCase()
    const apiRef = String(body.api_ref || "") // order reference or order id
    const amount = Number(body.value || body.net_amount || 0)
    const failureReason = body.failed_reason ? String(body.failed_reason) : null

    if (!invoiceId && !apiRef) {
      return NextResponse.json({ error: "Missing invoice_id or api_ref." }, { status: 400 })
    }

    // Service payment path — service payments live outside the order payment model.
    if (apiRef && apiRef.startsWith("SPB-")) {
      const servicePayment = await db.servicePayment.findFirst({
        where: { OR: [{ providerReference: invoiceId }, { booking: { reference: apiRef } }] },
        include: { booking: { include: { service: true, user: true } } },
        orderBy: { createdAt: "desc" },
      })
      if (servicePayment) {
        if (state === "COMPLETE") {
          const providerReference = invoiceId || servicePayment.providerReference || `INT-${Date.now()}`
          await db.servicePayment.update({ where: { id: servicePayment.id }, data: { status: "SUCCESS", providerReference, failureReason: null } })
          await db.serviceBooking.update({ where: { id: servicePayment.bookingId }, data: { paymentStatus: "PAID" } })
          await notifyServiceBooking({
            userId: servicePayment.booking.userId,
            customerName: servicePayment.booking.user.name,
            customerEmail: servicePayment.booking.user.email,
            reference: servicePayment.booking.reference,
            serviceName: servicePayment.booking.service.name,
            status: "Payment received",
            message: "Your card payment of KSh " + servicePayment.amount.toLocaleString() + " was received successfully.",
            start: servicePayment.booking.scheduledStart,
            end: servicePayment.booking.scheduledEnd,
            bookingId: servicePayment.bookingId,
            event: "SERVICE_PAYMENT_SUCCESS",
          })
          return NextResponse.json({ ok: true, servicePayment: { id: servicePayment.id, status: "SUCCESS", providerReference } })
        }
        if (state === "FAILED") {
          await db.servicePayment.update({ where: { id: servicePayment.id }, data: { status: "FAILED", failureReason: failureReason || "Transaction failed" } })
          return NextResponse.json({ ok: true, servicePayment: { id: servicePayment.id, status: "FAILED" } })
        }
        return NextResponse.json({ ok: true, servicePayment: { id: servicePayment.id, status: "PROCESSING" } })
      }
    }

    // Find order and payment
    let payment = await db.payment.findFirst({
      where: {
        OR: [
          { providerReference: invoiceId },
          { order: { reference: apiRef } },
          { orderId: apiRef },
        ],
      },
      include: { order: { include: ORDER_INCLUDE } },
      orderBy: { createdAt: "desc" },
    })

    if (!payment && apiRef) {
      const order = await db.order.findFirst({
        where: { OR: [{ reference: apiRef }, { id: apiRef }] },
        include: ORDER_INCLUDE,
      })

      if (order) {
        payment = await db.payment.create({
          data: {
            orderId: order.id,
            provider: "INTASEND",
            method: "CARD",
            status: state === "COMPLETE" ? "SUCCESS" : state === "FAILED" ? "FAILED" : "PROCESSING",
            amount: amount || order.total,
            providerReference: invoiceId || `INT-${Date.now()}`,
            failureReason,
          },
          include: { order: { include: ORDER_INCLUDE } },
        })
      }
    }

    if (!payment) {
      return NextResponse.json({ error: "No matching payment or order found." }, { status: 404 })
    }

    const order = payment.order

    if (state === "COMPLETE") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", providerReference: invoiceId || payment.providerReference, failureReason: null },
      })

      if (order && (order.status === "AWAITING_PAYMENT" || order.status === "PENDING" || order.status === "PRESCRIPTION_VERIFIED")) {
        await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
        await addStatusEvent(order.id, "PAID", "System", `Card payment confirmed via IntaSend webhook (${invoiceId || "Confirmed"})`)
        const earned = await awardPointsForOrder(order.id)

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
        const orderUrl = `${appUrl}/#order-${order.id}`

        const customerUser = order.userId
          ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true } })
          : null
        const customerName = customerUser?.name || order.guestName || "Valued Customer"

        const receiptEmail = paymentReceiptTemplate({
          orderReference: order.reference,
          customerName,
          amount: amount || order.total,
          method: "Card",
          pointsEarned: earned,
          orderUrl,
        })

        await notifyCustomer(
          order.userId,
          "PAYMENT",
          `Payment received — order ${order.reference}`,
          `Card payment of KSh ${(amount || order.total).toLocaleString()} confirmed.${earned > 0 ? ` You earned ${earned} Sphere Points.` : ""}`,
          "IN_APP",
          {
            link: orderUrl,
            metadata: { orderId: order.id, reference: order.reference, amount: amount || order.total, method: "Card" },
            email: customerUser?.email
              ? {
                  to: customerUser.email,
                  subject: receiptEmail.subject,
                  html: receiptEmail.html,
                  text: receiptEmail.text,
                }
              : undefined,
          }
        )

        await notifyStaff({
          roles: ["ADMIN", "STAFF", "PHARMACIST"],
          event: "PAYMENT_RECEIVED",
          title: `Card Payment Confirmed: ${order.reference}`,
          message: `IntaSend payment of KSh ${(amount || order.total).toLocaleString()} confirmed for order ${order.reference}.`,
          link: `${appUrl}/#admin-orders`,
          details: {
            "Order Ref": order.reference,
            Amount: `KSh ${(amount || order.total).toLocaleString()}`,
            Provider: "IntaSend Webhook",
            InvoiceId: invoiceId,
          },
        })
      }
    } else if (state === "FAILED") {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: failureReason || "Transaction failed" },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[IntaSend Webhook Error]", err)
    return NextResponse.json({ error: "Webhook processing error." }, { status: 500 })
  }
}
