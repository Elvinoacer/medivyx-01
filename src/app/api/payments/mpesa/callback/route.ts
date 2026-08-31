import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
import { awardPointsForOrder } from "@/lib/loyalty"

/** Daraja callback (simulated): the customer completed/declined the STK prompt.
 *  Demo rule (mirrored on the frontend): any PIN authorises; 1234/0000 = declined/wrong PIN. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const checkoutRequestId = String(body.checkoutRequestId ?? "")
    const result = body.result === "SUCCESS" ? "SUCCESS" : body.result === "FAILED" ? "FAILED" : "TIMEOUT"
    const pin = body.pin ? String(body.pin) : null

    const payment = await db.payment.findFirst({ where: { checkoutRequestId }, orderBy: { createdAt: "desc" } })
    if (!payment) return NextResponse.json({ error: "Payment request not found." }, { status: 404 })
    if (payment.status === "SUCCESS") {
      return NextResponse.json({ payment: { id: payment.id, status: payment.status }, orderStatus: "PAID" })
    }

    const order = await db.order.findUnique({ where: { id: payment.orderId }, include: ORDER_INCLUDE })

    if (result === "SUCCESS") {
      const providerReference = `Q${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-2).toUpperCase()}`
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", providerReference, failureReason: null },
      })
      if (order && order.status === "AWAITING_PAYMENT") {
        await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
        await addStatusEvent(order.id, "PAID", "System", "M-Pesa payment confirmed")
        const earned = await awardPointsForOrder(order.id)
        await notifyCustomer(order.userId, "PAYMENT", `Payment received — order ${order.reference}`, `M-Pesa payment of KSh ${order.total} confirmed.${earned > 0 ? ` You earned ${earned} Sphere Points.` : " Thank you!"}`)
        await notifyCustomer(order.userId, "PAYMENT", `Payment received — order ${order.reference}`, `M-Pesa payment of KSh ${order.total} confirmed.`, "SMS")
      }
      return NextResponse.json({ payment: { id: payment.id, status: "SUCCESS", providerReference }, orderStatus: "PAID" })
    }

    const failureReason =
      result === "TIMEOUT"
        ? "Request timed out — no response from your phone"
        : pin && ["1234", "0000"].includes(pin)
          ? "Incorrect M-Pesa PIN entered"
          : "Payment cancelled by user"
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason } })
    return NextResponse.json({ payment: { id: payment.id, status: "FAILED", failureReason }, orderStatus: order?.status ?? "AWAITING_PAYMENT" })
  } catch {
    return NextResponse.json({ error: "Could not process the payment result." }, { status: 500 })
  }
}
