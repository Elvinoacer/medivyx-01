import { reservePaymentAttempt } from "@/lib/security/payment-attempt"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tokenHash } from "@/lib/hash"
import { formatDarajaPhone, initiateStkPush, isDarajaConfigured } from "@/lib/mpesa/daraja"
import { money } from "@/lib/security/payment"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"
import { getSession } from "@/lib/session"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 8_192)
    if (tooLarge) return tooLarge
    const body = await request.json()
    const orderId = String(body.orderId || "")
    const rawPhone = String(body.phone || "").replace(/\s+/g, "")
    const match = PHONE_RE.exec(rawPhone)
    if (!match) return NextResponse.json({ error: "Enter a valid Safaricom number." }, { status: 400 })
    const phone = `+254${match[1]}`
    const idempotency = String(body.idempotencyKey || "")
    if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotency)) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 })
    const limited = await enforceRateLimit(request, "mpesa-initiate", 5, 15 * 60 * 1000, `${orderId}:${phone}`)
    if (limited) return limited
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
    const session = await getSession()
    const accessToken = request.headers.get("x-order-access-token") || String(body.accessToken || "")
    const guestAllowed = Boolean(accessToken && order.guestAccessTokenHash === tokenHash(accessToken) && order.guestAccessExpiresAt && order.guestAccessExpiresAt > new Date())
    if (!(session?.userId === order.userId || session?.staffId || guestAllowed)) return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 })
    if (order.status !== "AWAITING_PAYMENT" || Number(order.total) <= 0) return NextResponse.json({ error: "This order is not ready for payment. Wait for pharmacy confirmation." }, { status: 409 })
    if (await db.payment.findFirst({ where: { orderId, status: "SUCCESS" } })) return NextResponse.json({ error: "This order is already paid." }, { status: 409 })
    const amount = money(order.total)
    if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "M-Pesa requires a positive whole-KSh amount." }, { status: 409 })

  if (!isDarajaConfigured()) return NextResponse.json({ error: "M-Pesa is not configured for this environment." }, { status: 503 })
    const key = `order:${orderId}:mpesa:${idempotency}`
    const previous = await db.payment.findUnique({ where: { idempotencyKey: key } })
    if (previous?.checkoutRequestId) return NextResponse.json({ paymentId: previous.id, checkoutRequestId: previous.checkoutRequestId, message: "Payment request already sent." })
    const inFlight = await db.payment.findFirst({ where: { orderId, status: "PROCESSING", checkoutRequestId: { not: null }, createdAt: { gte: new Date(Date.now() - 15 * 60_000) } } })
    if (inFlight) return NextResponse.json({ error: "A payment request is already awaiting confirmation. Check its status before starting another." }, { status: 409 })
    let payment
    try { payment = await reservePaymentAttempt({ kind: "order", entityId: orderId, key, provider: "MPESA", method: "STK_PUSH", amount: order.total, phone }) }
    catch { return NextResponse.json({ error: "The payment is already in progress or this item is not ready for payment. Refresh its status before trying again." }, { status: 409 }) }
    if (!payment) return NextResponse.json({ error: "Could not reserve the payment request." }, { status: 503 })
    try {
      const result = await initiateStkPush({ phone: formatDarajaPhone(phone), amount, reference: order.reference, description: `Order ${order.reference}` })
      await db.$transaction([
        db.payment.updateMany({ where: { id: payment.id, status: "PROCESSING" }, data: { status: "PROCESSING", checkoutRequestId: result.checkoutRequestId } }),
      ])
      return NextResponse.json({ paymentId: payment.id, checkoutRequestId: result.checkoutRequestId, merchantRequestId: result.merchantRequestId, message: result.customerMessage })
    } catch {
      await db.payment.updateMany({ where: { id: payment.id, status: "PROCESSING" }, data: { status: "PROCESSING", failureReason: "Provider response uncertain; reconcile before another attempt" } })
      return NextResponse.json({ error: "We could not confirm the M-Pesa response. Check your phone and order status before trying again." }, { status: 503 })
    }
  } catch {
    return NextResponse.json({ error: "Could not start M-Pesa payment." }, { status: 500 })
  }
}
