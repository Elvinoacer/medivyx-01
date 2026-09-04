import { createHash, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { queryStkPush } from "@/lib/mpesa/daraja"
import { notifyServiceBooking, notifyStaff } from "@/lib/notify"
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
  if (priorEvent && (priorEvent.payloadHash !== payloadHash || priorEvent.servicePaymentId !== payment.id)) return NextResponse.json({ error: "Conflicting callback replay." }, { status: 409 })
  if (priorEvent) return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })

  try {
    let completed = false
    if (resultCode === 0) {
      const provider = await queryStkPush(checkoutRequestId)
      if (provider.status !== "SUCCESS" || !paymentMatchesExpected({ expectedAmount: payment.amount, actualAmount: amount, expectedCurrency: payment.currency, actualCurrency: "KES", expectedPhone: payment.phone, actualPhone: phone, receipt })) return NextResponse.json({ error: "Payment verification mismatch." }, { status: 409 })
    }
    await db.$transaction(async (tx) => {
      if (await tx.paymentWebhookEvent.findUnique({ where: { eventId } })) return
      await tx.paymentWebhookEvent.create({ data: { provider: "MPESA", eventId, payloadHash, servicePaymentId: payment.id } })
      if (resultCode === 0) {
        const changed = await tx.servicePayment.updateMany({ where: { id: payment.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS", providerReference: receipt, failureReason: null } })
        if (changed.count) {
          completed = true
          await tx.serviceBooking.update({ where: { id: payment.bookingId }, data: { paymentStatus: "PAID" } })
        }
      } else {
        await tx.servicePayment.updateMany({ where: { id: payment.id, status: { not: "SUCCESS" } }, data: { status: "FAILED", failureReason: `M-Pesa request failed (${resultCode})` } })
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    if (completed) {
      await notifyServiceBooking({ userId: payment.booking.userId, customerName: payment.booking.user.name, customerEmail: payment.booking.user.email, reference: payment.booking.reference, serviceName: payment.booking.service.name, status: "Payment received", message: `Your M-Pesa payment of KSh ${Number(payment.amount).toLocaleString()} was received.`, start: payment.booking.scheduledStart, end: payment.booking.scheduledEnd, bookingId: payment.bookingId, event: "SERVICE_PAYMENT_SUCCESS" })
      await notifyStaff({ roles: ["ADMIN", "PHARMACIST", "STAFF"], event: "SERVICE_PAYMENT_RECEIVED", title: `Service payment received: ${payment.booking.reference}`, message: `KSh ${Number(payment.amount).toLocaleString()} received for ${payment.booking.service.name}.`, link: "/admin/service-bookings" })
    }
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" })
  } catch {
    return NextResponse.json({ error: "Callback processing failed." }, { status: 503 })
  }
}
