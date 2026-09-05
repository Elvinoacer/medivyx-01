import { reservePaymentAttempt } from "@/lib/security/payment-attempt"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tokenHash } from "@/lib/hash"
import { createIntaSendCheckoutSession, isIntaSendConfigured } from "@/lib/intasend/client"
import { money } from "@/lib/security/payment"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"
import { getSession } from "@/lib/session"

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 8_192)
    if (tooLarge) return tooLarge
    const body = await request.json()
    if (body.mode && body.mode !== "checkout") return NextResponse.json({ error: "Card details must be entered only on IntaSend's hosted checkout." }, { status: 400 })
    const orderId = String(body.orderId || "")
    const idempotency = String(body.idempotencyKey || "")
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotency)) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 })
    const limited = await enforceRateLimit(request, "intasend-initiate", 8, 15 * 60 * 1000, orderId)
    if (limited) return limited
    const session = await getSession()
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
    const accessToken = request.headers.get("x-order-access-token") || String(body.accessToken || "")
    const guestAllowed = Boolean(accessToken && order.guestAccessTokenHash === tokenHash(accessToken) && order.guestAccessExpiresAt && order.guestAccessExpiresAt > new Date())
    if (!(session?.userId === order.userId || session?.staffId || guestAllowed)) return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 })
    if (order.status !== "AWAITING_PAYMENT" || Number(order.total) <= 0) return NextResponse.json({ error: "This order is not ready for payment. Wait for pharmacy confirmation." }, { status: 409 })
    if (await db.payment.findFirst({ where: { orderId, status: "SUCCESS" } })) return NextResponse.json({ error: "This order is already paid." }, { status: 409 })

  if (!isIntaSendConfigured()) return NextResponse.json({ error: "Card payments are not configured for this environment." }, { status: 503 })
    const key = `order:${orderId}:intasend:${idempotency}`
    const previous = await db.payment.findUnique({ where: { idempotencyKey: key } })
    if (previous?.status === "PROCESSING" && previous.checkoutRequestId && previous.providerReference?.startsWith("https://")) return NextResponse.json({ paymentId: previous.id, status: previous.status, sessionId: previous.checkoutRequestId, checkoutUrl: previous.providerReference })
    let payment
    try { payment = await reservePaymentAttempt({ kind: "order", entityId: orderId, key, provider: "INTASEND", method: "HOSTED_CHECKOUT", amount: order.total }) }
    catch { return NextResponse.json({ error: "The payment is already in progress or this item is not ready for payment. Refresh its status before trying again." }, { status: 409 }) }
    if (!payment) return NextResponse.json({ error: "Could not reserve the payment request." }, { status: 503 })
    const customer = order.userId ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true, phone: true } }) : null
    try {
      const checkout = await createIntaSendCheckoutSession({ orderId, reference: payment.id, amount: money(order.total), customer: { name: customer?.name || order.guestName || "Customer", email: customer?.email || order.guestEmail, phone: customer?.phone || order.guestPhone } })
      await db.payment.updateMany({ where: { id: payment.id, status: "PROCESSING" }, data: { status: "PROCESSING", checkoutRequestId: checkout.id, providerReference: checkout.url } })
      return NextResponse.json({ paymentId: payment.id, status: "PROCESSING", checkoutUrl: checkout.url, sessionId: checkout.id })
    } catch {
      await db.payment.updateMany({ where: { id: payment.id, status: "PROCESSING" }, data: { status: "PROCESSING", failureReason: "Checkout response uncertain; reconcile before another attempt" } })
      return NextResponse.json({ error: "Card checkout is temporarily unavailable." }, { status: 503 })
    }
  } catch {
    return NextResponse.json({ error: "Could not start card checkout." }, { status: 500 })
  }
}
