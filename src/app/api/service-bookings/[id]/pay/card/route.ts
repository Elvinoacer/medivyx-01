import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { createIntaSendCheckoutSession } from "@/lib/intasend/client"
import { money } from "@/lib/security/payment"
import { enforceRateLimit, isUniqueConstraintError, rejectOversizedRequest } from "@/lib/security/request"

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const tooLarge = rejectOversizedRequest(request, 8_192)
  if (tooLarge) return tooLarge
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  const { id } = await ctx.params
  const limited = await enforceRateLimit(request, "service-card", 8, 15 * 60_000, id)
  if (limited) return limited
  const body = await request.json().catch(() => ({}))
  const idempotency = String(body.idempotencyKey || "")
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotency)) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 })
  const booking = await db.serviceBooking.findUnique({ where: { id }, include: { service: true } })
  if (!booking || booking.userId !== session.userId) return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  if (booking.paymentStatus === "PAID" || ["CANCELLED", "REJECTED", "COMPLETED"].includes(booking.status)) return NextResponse.json({ error: "This booking cannot be paid." }, { status: 409 })
  if (Number(booking.price || 0) <= 0) return NextResponse.json({ error: "This booking does not require an online payment." }, { status: 409 })
  const key = `service:${id}:intasend:${idempotency}`
  const previous = await db.servicePayment.findUnique({ where: { idempotencyKey: key } })
  if (previous?.checkoutRequestId && previous.providerReference) return NextResponse.json({ paymentId: previous.id, checkoutUrl: previous.providerReference, sessionId: previous.checkoutRequestId, status: previous.status })
  let payment = previous
  if (!payment) try { payment = await db.servicePayment.create({ data: { bookingId: id, provider: "INTASEND", method: "HOSTED_CHECKOUT", status: "PENDING", amount: booking.price!, currency: "KES", idempotencyKey: key } }) }
  catch (createError) { if (!isUniqueConstraintError(createError)) throw createError; payment = await db.servicePayment.findUnique({ where: { idempotencyKey: key } }) }
  if (!payment) return NextResponse.json({ error: "Could not reserve the payment request." }, { status: 503 })
  try {
    const checkout = await createIntaSendCheckoutSession({ orderId: booking.id, reference: booking.reference, amount: money(booking.price!), customer: { name: session.user?.name || "Customer", email: session.user?.email, phone: session.user?.phone || undefined }, redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"}/services` })
    await db.servicePayment.update({ where: { id: payment.id }, data: { status: "PROCESSING", checkoutRequestId: checkout.id, providerReference: checkout.url } })
    return NextResponse.json({ paymentId: payment.id, checkoutUrl: checkout.url, sessionId: checkout.id, status: "PROCESSING" })
  } catch {
    await db.servicePayment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Payment provider could not create checkout" } })
    return NextResponse.json({ error: "Card checkout is temporarily unavailable." }, { status: 503 })
  }
}
