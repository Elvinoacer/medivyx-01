import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { formatDarajaPhone, initiateStkPush } from "@/lib/mpesa/daraja"
import { money } from "@/lib/security/payment"
import { enforceRateLimit, isUniqueConstraintError, rejectOversizedRequest } from "@/lib/security/request"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const tooLarge = rejectOversizedRequest(request, 8_192)
  if (tooLarge) return tooLarge
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const phone = formatDarajaPhone(String(body.phone || session.user?.phone || ""))
  if (!/^254[71]\d{8}$/.test(phone)) return NextResponse.json({ error: "Enter a valid Kenyan M-Pesa number." }, { status: 400 })
  const idempotency = String(body.idempotencyKey || "")
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotency)) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 })
  const limited = await enforceRateLimit(request, "service-mpesa", 5, 15 * 60_000, `${id}:${phone}`)
  if (limited) return limited
  const booking = await db.serviceBooking.findUnique({ where: { id } })
  if (!booking || booking.userId !== session.userId) return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  if (booking.paymentStatus === "PAID" || ["CANCELLED", "REJECTED", "COMPLETED"].includes(booking.status)) return NextResponse.json({ error: "This booking cannot be paid." }, { status: 409 })
  const amount = money(booking.price || 0)
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "M-Pesa requires a positive whole-KSh amount." }, { status: 409 })
  const key = `service:${id}:mpesa:${idempotency}`
  const previous = await db.servicePayment.findUnique({ where: { idempotencyKey: key } })
  if (previous?.checkoutRequestId) return NextResponse.json({ paymentId: previous.id, checkoutRequestId: previous.checkoutRequestId, message: "Payment request already sent." })
  const inFlight = await db.servicePayment.findFirst({ where: { bookingId: id, status: "PROCESSING", checkoutRequestId: { not: null }, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } })
  if (inFlight) return NextResponse.json({ error: "A payment request is already awaiting confirmation. Check its status before starting another." }, { status: 409 })
  let payment = previous
  if (!payment) try { payment = await db.servicePayment.create({ data: { bookingId: id, provider: "MPESA", method: "STK_PUSH", status: "PENDING", amount: booking.price!, currency: "KES", phone: `+${phone}`, idempotencyKey: key } }) }
  catch (createError) { if (!isUniqueConstraintError(createError)) throw createError; payment = await db.servicePayment.findUnique({ where: { idempotencyKey: key } }) }
  if (!payment) return NextResponse.json({ error: "Could not reserve the payment request." }, { status: 503 })
  const callbackSecret = process.env.MPESA_CALLBACK_TOKEN || ""
  if (callbackSecret.length < 24) return NextResponse.json({ error: "M-Pesa is not configured." }, { status: 503 })
  try {
    const stk = await initiateStkPush({ phone, amount, reference: booking.reference, description: `Service ${booking.reference}`, callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"}/api/payments/mpesa/service-callback?token=${encodeURIComponent(callbackSecret)}` })
    await db.$transaction([
      db.servicePayment.update({ where: { id: payment.id }, data: { status: "PROCESSING", checkoutRequestId: stk.checkoutRequestId } }),
      db.servicePayment.updateMany({ where: { bookingId: id, id: { not: payment.id }, status: { in: ["PENDING", "PROCESSING"] }, method: "STK_PUSH" }, data: { status: "FAILED", failureReason: "Superseded by a new payment request" } }),
    ])
    return NextResponse.json({ paymentId: payment.id, checkoutRequestId: stk.checkoutRequestId, message: stk.customerMessage })
  } catch {
    await db.servicePayment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "M-Pesa request could not be started" } })
    return NextResponse.json({ error: "M-Pesa is temporarily unavailable. No payment was taken." }, { status: 503 })
  }
}
