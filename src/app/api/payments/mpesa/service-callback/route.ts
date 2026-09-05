import { notifyPaymentOutcome } from "@/lib/notifications/payment"
import { createHash, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { queryStkPush } from "@/lib/mpesa/daraja"
import { paymentMatchesExpected } from "@/lib/security/payment"

interface CallbackItem { Name: string; Value?: string | number }

function authenticated(request: Request): boolean {
  const expected = process.env.MPESA_CALLBACK_TOKEN || ""
  const provided = new URL(request.url).searchParams.get("token") || ""
  const left = Buffer.from(expected), right = Buffer.from(provided)
  return expected.length >= 24 && left.length === right.length && timingSafeEqual(left, right)
}

export async function POST(request: Request) {
  if (!authenticated(request)) return NextResponse.json({ error: "Invalid callback authentication." }, { status: 401 })
  const raw = await request.text()
  let body: { Body?: { stkCallback?: Record<string, unknown> } }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }) }
  const callback = body.Body?.stkCallback
  if (!callback) return NextResponse.json({ error: "Invalid callback payload." }, { status: 400 })
  const checkoutRequestId = String(callback.CheckoutRequestID || "")
  const resultCode = Number(callback.ResultCode)
  if (!checkoutRequestId || !Number.isInteger(resultCode)) return NextResponse.json({ error: "Incomplete callback payload." }, { status: 400 })
  const items = ((callback.CallbackMetadata as { Item?: CallbackItem[] } | undefined)?.Item || [])
  const value = (name: string) => items.find((item) => item.Name === name)?.Value
  const receipt = value("MpesaReceiptNumber") ? String(value("MpesaReceiptNumber")) : null
  const phone = value("PhoneNumber") ? String(value("PhoneNumber")) : null
  const amount = value("Amount")
  const payment = await db.servicePayment.findUnique({ where: { provider_checkoutRequestId: { provider: "MPESA", checkoutRequestId } }, include: { booking: { include: { service: true, user: true } } } })
  if (!payment) return NextResponse.json({ error: "Unknown payment attempt." }, { status: 404 })
  const eventId = `mpesa-service:${checkoutRequestId}:${resultCode}:${receipt || "none"}`
  const payloadHash = createHash("sha256").update(raw).digest("hex")
  const priorEvent = await db.paymentWebhookEvent.findUnique({ where: { eventId } })
  if (priorEvent && (priorEvent.servicePaymentId !== payment.id)) return NextResponse.json({ error: "Conflicting callback replay." }, { status: 409 })
  if (priorEvent) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })

  try {
    if (resultCode === 0) {
      const provider = await queryStkPush(checkoutRequestId)
      if (provider.status !== "SUCCESS" || !paymentMatchesExpected({ expectedAmount: payment.amount, actualAmount: amount, expectedCurrency: payment.currency, actualCurrency: "KES", expectedPhone: payment.phone, actualPhone: phone, receipt })) return NextResponse.json({ error: "Payment verification mismatch." }, { status: 409 })
    }
    await db.$transaction(async (tx) => {
      if (await tx.paymentWebhookEvent.findUnique({ where: { eventId } })) return
      await tx.paymentWebhookEvent.create({ data: { provider: "MPESA", eventId, payloadHash, servicePaymentId: payment.id } })
      if (resultCode === 0) {
        const changed = await tx.servicePayment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } }, data: { status: "SUCCESS", providerReference: receipt, failureReason: null } })
        if (changed.count) {
      await notifyPaymentOutcome(tx, { paymentId: payment.id, bookingId: payment.bookingId, success: true })
          await tx.serviceBooking.update({ where: { id: payment.bookingId }, data: { paymentStatus: "PAID" } })
        }
      } else {
        const failedPayment = await tx.servicePayment.updateMany({ where: { id: payment.id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } }, data: { status: "FAILED", failureReason: `M-Pesa request failed (${resultCode})` } })
        if (failedPayment.count) await notifyPaymentOutcome(tx, { paymentId: payment.id, bookingId: payment.bookingId, success: false })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
  } catch {
    return NextResponse.json({ error: "Callback processing failed." }, { status: 503 })
  }
}
