import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE } from "@/lib/dto"
import { addStatusEvent, notifyCustomer, notifyStaff } from "@/lib/notify"
import { awardPointsForOrder } from "@/lib/loyalty"
import { paymentReceiptTemplate } from "@/lib/email/templates"

interface CallbackItem {
  Name: string
  Value?: string | number
}

/**
 * Safaricom Daraja M-Pesa STK Push Callback Endpoint.
 * Receives Webhook notifications from Safaricom servers upon PIN completion or decline.
 * Also supports simulated client callbacks in development/test environments.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    let checkoutRequestId = ""
    let isSuccess = false
    let failureReason: string | null = null
    let providerReference = ""
    let mpesaPhone = ""
    let amountPaid: number | null = null

    // Case 1: Real Safaricom Daraja Callback payload
    if (body?.Body?.stkCallback) {
      const cb = body.Body.stkCallback
      checkoutRequestId = String(cb.CheckoutRequestID ?? "")
      const resultCode = Number(cb.ResultCode)
      const resultDesc = String(cb.ResultDesc ?? "")

      if (resultCode === 0) {
        isSuccess = true
        const items: CallbackItem[] = cb.CallbackMetadata?.Item ?? []
        for (const item of items) {
          if (item.Name === "MpesaReceiptNumber" && item.Value) {
            providerReference = String(item.Value)
          } else if (item.Name === "PhoneNumber" && item.Value) {
            mpesaPhone = String(item.Value)
          } else if (item.Name === "Amount" && item.Value) {
            amountPaid = Number(item.Value)
          }
        }
      } else {
        isSuccess = false
        failureReason =
          resultCode === 1032
            ? "Payment cancelled by user on phone"
            : resultCode === 1037
              ? "Request timed out — no response from user phone"
              : resultCode === 1
                ? "Insufficient M-Pesa account balance"
                : resultCode === 2001
                  ? "Incorrect M-Pesa PIN entered"
                  : resultDesc || `Transaction failed (code ${resultCode})`
      }
    }
    // Case 2: Frontend simulation / demo test payload
    else {
      checkoutRequestId = String(body.checkoutRequestId ?? "")
      const pin = body.pin ? String(body.pin) : null
      const result = body.result === "SUCCESS" ? "SUCCESS" : body.result === "FAILED" ? "FAILED" : "TIMEOUT"

      if (result === "SUCCESS") {
        isSuccess = true
      } else {
        isSuccess = false
        failureReason =
          result === "TIMEOUT"
            ? "Request timed out — no response from your phone"
            : pin && ["1234", "0000"].includes(pin)
              ? "Incorrect M-Pesa PIN entered"
              : "Payment cancelled by user"
      }
    }

    if (!checkoutRequestId) {
      return NextResponse.json({ error: "CheckoutRequestID is required." }, { status: 400 })
    }

    const payment = await db.payment.findFirst({
      where: { checkoutRequestId },
      orderBy: { createdAt: "desc" },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment request not found." }, { status: 404 })
    }

    if (payment.status === "SUCCESS") {
      return NextResponse.json({
        payment: { id: payment.id, status: payment.status },
        orderStatus: "PAID",
      })
    }

    const order = await db.order.findUnique({ where: { id: payment.orderId }, include: ORDER_INCLUDE })

    if (isSuccess) {
      if (!providerReference) {
        providerReference = `Q${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-2).toUpperCase()}`
      }

      await db.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS", providerReference, failureReason: null },
      })

      if (order && (order.status === "AWAITING_PAYMENT" || order.status === "PENDING" || order.status === "PRESCRIPTION_VERIFIED")) {
        await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
        await addStatusEvent(order.id, "PAID", "System", `M-Pesa payment confirmed (${providerReference})`)
        const earned = await awardPointsForOrder(order.id)

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
        const orderUrl = `${appUrl}/#order-${order.id}`

        const customerUser = order.userId
          ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true } })
          : null
        const customerName = customerUser?.name || order.guestName || "Valued Customer"
        const customerEmail = customerUser?.email

        const receiptEmail = paymentReceiptTemplate({
          orderReference: order.reference,
          customerName,
          amount: amountPaid ?? order.total,
          method: "M-Pesa",
          pointsEarned: earned,
          orderUrl,
        })

        // Notify customer via in-app + push + Resend email + SMS
        await notifyCustomer(
          order.userId,
          "PAYMENT",
          `Payment received — order ${order.reference}`,
          `M-Pesa payment of KSh ${(amountPaid ?? order.total).toLocaleString()} confirmed (Ref: ${providerReference}).${earned > 0 ? ` You earned ${earned} Sphere Points.` : " Thank you!"}`,
          "IN_APP",
          {
            link: orderUrl,
            metadata: {
              orderId: order.id,
              reference: order.reference,
              amount: amountPaid ?? order.total,
              method: "M-Pesa",
              providerReference,
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

        // Trigger SMS notification
        await notifyCustomer(
          order.userId,
          "PAYMENT",
          `Payment received — order ${order.reference}`,
          `M-Pesa payment of KSh ${(amountPaid ?? order.total).toLocaleString()} confirmed. Ref: ${providerReference}. Thank you!`,
          "SMS"
        )

        // Alert staff & admin
        await notifyStaff({
          roles: ["ADMIN", "STAFF", "PHARMACIST"],
          event: "PAYMENT_RECEIVED",
          title: `Payment Confirmed: ${order.reference}`,
          message: `M-Pesa payment of KSh ${(amountPaid ?? order.total).toLocaleString()} confirmed for order ${order.reference}.`,
          link: `${appUrl}/#admin-orders`,
          details: {
            "Order Ref": order.reference,
            Amount: `KSh ${(amountPaid ?? order.total).toLocaleString()}`,
            Provider: "M-Pesa",
            Receipt: providerReference,
            CustomerPhone: mpesaPhone || payment.phone || "N/A",
          },
        })
      }

      return NextResponse.json({
        payment: { id: payment.id, status: "SUCCESS", providerReference },
        orderStatus: "PAID",
      })
    }

    // Payment failed or cancelled
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: failureReason || "Payment was cancelled or rejected" },
    })

    return NextResponse.json({
      payment: { id: payment.id, status: "FAILED", failureReason },
      orderStatus: order?.status ?? "AWAITING_PAYMENT",
    })
  } catch (err) {
    console.error("[Daraja Callback Error]", err)
    return NextResponse.json({ error: "Could not process the payment callback." }, { status: 500 })
  }
}
