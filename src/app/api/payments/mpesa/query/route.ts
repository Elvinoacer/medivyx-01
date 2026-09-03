import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE } from "@/lib/dto"
import { queryStkPush, isDarajaConfigured } from "@/lib/mpesa/daraja"
import { addStatusEvent, notifyCustomer, notifyStaff } from "@/lib/notify"
import { awardPointsForOrder } from "@/lib/loyalty"
import { paymentReceiptTemplate } from "@/lib/email/templates"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const checkoutRequestId = searchParams.get("checkoutRequestId")

    if (!checkoutRequestId) {
      return NextResponse.json({ error: "checkoutRequestId is required." }, { status: 400 })
    }

    const payment = await db.payment.findFirst({
      where: { checkoutRequestId },
      orderBy: { createdAt: "desc" },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 })
    }

    // Already decided in DB
    if (payment.status === "SUCCESS") {
      return NextResponse.json({
        status: "SUCCESS",
        payment: { id: payment.id, status: "SUCCESS", reference: payment.providerReference },
        orderStatus: "PAID",
      })
    }

    if (payment.status === "FAILED") {
      return NextResponse.json({
        status: "FAILED",
        payment: { id: payment.id, status: "FAILED", failureReason: payment.failureReason },
        orderStatus: "AWAITING_PAYMENT",
      })
    }

    // If still PROCESSING and Daraja is configured, query Safaricom live
    if (isDarajaConfigured()) {
      const queryResult = await queryStkPush(checkoutRequestId)

      if (queryResult.status === "SUCCESS") {
        const providerReference = `Q${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-2).toUpperCase()}`
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "SUCCESS", providerReference, failureReason: null },
        })

        const order = await db.order.findUnique({ where: { id: payment.orderId }, include: ORDER_INCLUDE })
        if (order && (order.status === "AWAITING_PAYMENT" || order.status === "PENDING" || order.status === "PRESCRIPTION_VERIFIED")) {
          await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
          await addStatusEvent(order.id, "PAID", "System", `M-Pesa payment confirmed via STK query (${providerReference})`)
          const earned = await awardPointsForOrder(order.id)

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
          const orderUrl = `${appUrl}/#order-${order.id}`

          const customerUser = order.userId
            ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true } })
            : null
          const customerName = customerUser?.name || order.guestName || "Customer"

          const receiptEmail = paymentReceiptTemplate({
            orderReference: order.reference,
            customerName,
            amount: order.total,
            method: "M-Pesa",
            pointsEarned: earned,
            orderUrl,
          })

          await notifyCustomer(
            order.userId,
            "PAYMENT",
            `Payment received — order ${order.reference}`,
            `M-Pesa payment of KSh ${order.total.toLocaleString()} confirmed. Ref: ${providerReference}.${earned > 0 ? ` You earned ${earned} Sphere Points.` : ""}`,
            "IN_APP",
            {
              link: orderUrl,
              metadata: { orderId: order.id, reference: order.reference, amount: order.total, providerReference },
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
            title: `Payment Confirmed: ${order.reference}`,
            message: `M-Pesa payment of KSh ${order.total.toLocaleString()} confirmed for order ${order.reference}.`,
            link: `${appUrl}/#admin-orders`,
            details: {
              "Order Ref": order.reference,
              Amount: `KSh ${order.total.toLocaleString()}`,
              Provider: "M-Pesa",
              Receipt: providerReference,
            },
          })
        }

        return NextResponse.json({
          status: "SUCCESS",
          payment: { id: payment.id, status: "SUCCESS", reference: providerReference },
          orderStatus: "PAID",
        })
      }

      if (queryResult.status === "FAILED") {
        await db.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failureReason: queryResult.resultDesc || "Transaction cancelled or failed" },
        })
        return NextResponse.json({
          status: "FAILED",
          payment: { id: payment.id, status: "FAILED", failureReason: queryResult.resultDesc },
          orderStatus: "AWAITING_PAYMENT",
        })
      }
    }

    return NextResponse.json({
      status: "PENDING",
      payment: { id: payment.id, status: payment.status },
      orderStatus: "AWAITING_PAYMENT",
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error querying M-Pesa status"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
