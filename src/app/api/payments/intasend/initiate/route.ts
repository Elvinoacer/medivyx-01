import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { addStatusEvent, notifyCustomer } from "@/lib/notify"
import { awardPointsForOrder } from "@/lib/loyalty"

/** IntaSend card payment — simulated. In production: create a checkout session,
 *  redirect to IntaSend's hosted/tokenised flow, confirm via webhook. No raw card
 *  data would ever touch our servers — here we only keep last4 for the demo. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = String(body.orderId ?? "")
    const card = body.card ?? {}
    const number = String(card.number ?? "").replace(/\s+/g, "")
    const name = String(card.name ?? "").trim()
    const expiry = String(card.expiry ?? "").trim()
    const cvv = String(card.cvv ?? "").trim()

    if (!/^\d{13,19}$/.test(number)) return NextResponse.json({ error: "Enter a valid card number." }, { status: 400 })
    if (name.length < 2) return NextResponse.json({ error: "Enter the name on the card." }, { status: 400 })
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return NextResponse.json({ error: "Expiry must be MM/YY." }, { status: 400 })
    const [mm, yy] = expiry.split("/").map(Number)
    const now = new Date()
    const expYear = 2000 + yy
    if (expYear < now.getFullYear() || (expYear === now.getFullYear() && mm < now.getMonth() + 1)) {
      return NextResponse.json({ error: "This card has expired." }, { status: 400 })
    }
    if (!/^\d{3,4}$/.test(cvv)) return NextResponse.json({ error: "Enter the 3-digit CVV." }, { status: 400 })

    const session = await getSession()
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
    const isOwner = session?.userId && order.userId === session.userId
    const isStaff = Boolean(session?.staffId)
    if (!isOwner && !isStaff) return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 })

    const alreadyPaid = await db.payment.findFirst({ where: { orderId, status: "SUCCESS" } })
    if (alreadyPaid) return NextResponse.json({ error: "This order is already paid." }, { status: 400 })

    const payment = await db.payment.create({
      data: {
        orderId, provider: "INTASEND", method: "CARD", status: "PROCESSING",
        amount: order.total, cardLast4: number.slice(-4),
      },
    })

    // demo decline rules: test cards ending 0000 or CVV 000 are declined
    const declined = number.endsWith("0000") || cvv === "000"
    if (declined) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "Card declined by issuer (demo)" },
      })
      return NextResponse.json({ paymentId: payment.id, status: "FAILED", failureReason: "Card declined by issuer (demo)" })
    }

    const reference = `INT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "SUCCESS", providerReference: reference },
    })
    if (order.status === "AWAITING_PAYMENT") {
      await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
      await addStatusEvent(order.id, "PAID", "System", "Card payment confirmed (IntaSend)")
      const earned = await awardPointsForOrder(order.id)
      await notifyCustomer(order.userId, "PAYMENT", `Payment received — order ${order.reference}`, `Card payment of KSh ${order.total} confirmed.${earned > 0 ? ` You earned ${earned} Sphere Points.` : " Thank you!"}`)
    }
    return NextResponse.json({ paymentId: payment.id, status: "SUCCESS", reference })
  } catch {
    return NextResponse.json({ error: "Could not process the card payment. Please try again." }, { status: 500 })
  }
}
