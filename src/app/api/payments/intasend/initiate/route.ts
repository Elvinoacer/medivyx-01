import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { addStatusEvent, notifyCustomer, notifyStaff } from "@/lib/notify"
import { awardPointsForOrder } from "@/lib/loyalty"
import { paymentReceiptTemplate } from "@/lib/email/templates"
import { chargeIntaSendCard, createIntaSendCheckoutSession } from "@/lib/intasend/client"

/**
 * IntaSend Card Payment Initiation.
 * Supports direct Visa/Mastercard processing and hosted checkout session creation.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = String(body.orderId ?? "")
    const mode = body.mode === "checkout" ? "checkout" : "direct"

    const session = await getSession()
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

    const isOwner = session?.userId && order.userId === session.userId
    const isStaff = Boolean(session?.staffId)
    if (!isOwner && !isStaff && order.guestPhone !== body.guestPhone) {
      return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 })
    }

    const alreadyPaid = await db.payment.findFirst({ where: { orderId, status: "SUCCESS" } })
    if (alreadyPaid) return NextResponse.json({ error: "This order is already paid." }, { status: 400 })

    const customerUser = order.userId
      ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true, phone: true } })
      : null
    const customerName = customerUser?.name || order.guestName || "Valued Customer"
    const customerEmail = customerUser?.email
    const customerPhone = customerUser?.phone || order.guestPhone

    // Mode A: Hosted checkout session
    if (mode === "checkout") {
      const checkoutRes = await createIntaSendCheckoutSession({
        orderId: order.id,
        reference: order.reference,
        amount: order.total,
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone ?? undefined,
        },
      })

      const payment = await db.payment.create({
        data: {
          orderId,
          provider: "INTASEND",
          method: "CARD",
          status: "PROCESSING",
          amount: order.total,
          providerReference: checkoutRes.id,
        },
      })

      return NextResponse.json({
        paymentId: payment.id,
        status: "PROCESSING",
        checkoutUrl: checkoutRes.url,
        sessionId: checkoutRes.id,
      })
    }

    // Mode B: Direct card charge
    const card = body.card ?? {}
    const number = String(card.number ?? "").replace(/\s+/g, "")
    const name = String(card.name ?? "").trim()
    const expiry = String(card.expiry ?? "").trim()
    const cvv = String(card.cvv ?? "").trim()

    const chargeResult = await chargeIntaSendCard({
      orderId: order.id,
      reference: order.reference,
      amount: order.total,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone ?? undefined,
      },
      card: { number, name, expiry, cvv },
    })

    const payment = await db.payment.create({
      data: {
        orderId,
        provider: "INTASEND",
        method: "CARD",
        status: chargeResult.status === "SUCCESS" ? "SUCCESS" : chargeResult.status === "REQUIRES_3DS" ? "PROCESSING" : "FAILED",
        amount: order.total,
        cardLast4: number.slice(-4),
        providerReference: chargeResult.reference,
        failureReason: chargeResult.failureReason,
      },
    })

    if (chargeResult.status === "REQUIRES_3DS") {
      return NextResponse.json({
        paymentId: payment.id,
        status: "REQUIRES_3DS",
        redirectUrl: chargeResult.redirectUrl,
      })
    }

    if (chargeResult.status !== "SUCCESS") {
      return NextResponse.json({
        paymentId: payment.id,
        status: "FAILED",
        failureReason: chargeResult.failureReason || "Card transaction could not be authorized.",
      })
    }

    // Process successful payment
    if (order.status === "AWAITING_PAYMENT" || order.status === "PENDING" || order.status === "PRESCRIPTION_VERIFIED") {
      await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
      await addStatusEvent(order.id, "PAID", "System", `Card payment confirmed via IntaSend (${chargeResult.reference})`)
      const earned = await awardPointsForOrder(order.id)

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
      const orderUrl = `${appUrl}/#order-${order.id}`

      const receiptEmail = paymentReceiptTemplate({
        orderReference: order.reference,
        customerName,
        amount: order.total,
        method: "Card (Visa/Mastercard)",
        pointsEarned: earned,
        orderUrl,
      })

      await notifyCustomer(
        order.userId,
        "PAYMENT",
        `Payment received — order ${order.reference}`,
        `Card payment of KSh ${order.total.toLocaleString()} confirmed.${earned > 0 ? ` You earned ${earned} Sphere Points.` : " Thank you!"}`,
        "IN_APP",
        {
          link: orderUrl,
          metadata: {
            orderId: order.id,
            reference: order.reference,
            amount: order.total,
            method: "Card",
            providerReference: chargeResult.reference,
          },
          email: customerEmail
            ? {
                to: customerEmail,
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
        message: `Card payment of KSh ${order.total.toLocaleString()} received for order ${order.reference}.`,
        link: `${appUrl}/#admin-orders`,
        details: {
          "Order Ref": order.reference,
          Amount: `KSh ${order.total.toLocaleString()}`,
          Provider: "Card (IntaSend)",
          Reference: chargeResult.reference || "N/A",
          Card: `**** ${number.slice(-4)}`,
        },
      })
    }

    return NextResponse.json({
      paymentId: payment.id,
      status: "SUCCESS",
      reference: chargeResult.reference,
      simulated: chargeResult.simulated ?? false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not process the card payment."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
