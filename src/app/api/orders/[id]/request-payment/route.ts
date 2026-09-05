import { reservePaymentAttempt } from "@/lib/security/payment-attempt"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
import { formatDarajaPhone, initiateStkPush, isDarajaConfigured } from "@/lib/mpesa/daraja"
import { money } from "@/lib/security/payment"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"
import { audit, notifyCustomer } from "@/lib/notify"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/
const PAYABLE = ["PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED", "AWAITING_PAYMENT", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"]

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF", "PHARMACIST", "RIDER"])
  if (error) return error
  const sizeError = rejectOversizedRequest(request, 8 * 1024)
  if (sizeError) return sizeError
  const { id } = await params
  const limited = await enforceRateLimit(request, "staff-payment-request", 5, 15 * 60_000, id)
  if (limited) return limited
  const body = await request.json().catch(() => ({}))
  const idempotency = String(body.idempotencyKey || "")
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(idempotency)) return NextResponse.json({ error: "A valid idempotency key is required." }, { status: 400 })
  const order = await db.order.findUnique({ where: { id }, include: { user: { select: { phone: true } }, prescriptions: { where: { deletedAt: null }, select: { status: true } } } })
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  if (session.staffRole === "RIDER" && (order.riderId !== session.staffId || order.status !== "OUT_FOR_DELIVERY")) return NextResponse.json({ error: "Riders may request payment only for their assigned delivery." }, { status: 403 })
  if (!PAYABLE.includes(order.status)) return NextResponse.json({ error: "This order is not ready for payment." }, { status: 409 })
  if (order.prescriptions.length && order.prescriptions.some((rx) => !["APPROVED", "PARTIALLY_APPROVED"].includes(rx.status))) return NextResponse.json({ error: "Prescription review must be completed before payment." }, { status: 409 })
  if (await db.payment.findFirst({ where: { orderId: id, status: "SUCCESS" }, select: { id: true } })) return NextResponse.json({ error: "This order is already paid." }, { status: 409 })
  const match = PHONE_RE.exec(String(body.phone || order.guestPhone || order.user?.phone || "").replace(/\s+/g, ""))
  if (!match) return NextResponse.json({ error: "Enter a valid Kenyan M-Pesa number." }, { status: 400 })
  const phone = `+254${match[1]}`
  const amount = money(order.total)
  if (!Number.isSafeInteger(amount) || amount <= 0) return NextResponse.json({ error: "M-Pesa requires a positive whole-KSh amount." }, { status: 409 })
  const key = `staff:${id}:mpesa:${idempotency}`
  const existing = await db.payment.findUnique({ where: { idempotencyKey: key } })
  if (existing?.checkoutRequestId) return NextResponse.json({ paymentId: existing.id, checkoutRequestId: existing.checkoutRequestId, message: "Payment request already sent." })
  if (!isDarajaConfigured()) return NextResponse.json({ error: "M-Pesa is not configured." }, { status: 503 })
  let payment
  try { payment = await reservePaymentAttempt({ kind: "order", entityId: id, key, provider: "MPESA", method: "STK_PUSH", amount: order.total, phone, staffRequest: true }) }
  catch { return NextResponse.json({ error: "A payment is in progress or this order changed. Refresh before trying again." }, { status: 409 }) }
  try {
    const result = await initiateStkPush({ phone: formatDarajaPhone(phone), amount, reference: order.reference, description: `Order ${order.reference}` })
    await db.$transaction([
      db.payment.updateMany({ where: { id: payment.id, status: "PROCESSING" }, data: { status: "PROCESSING", checkoutRequestId: result.checkoutRequestId } }),
    ])
    if (["PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED"].includes(order.status)) await db.order.updateMany({ where: { id, status: order.status }, data: { status: "AWAITING_PAYMENT", version: { increment: 1 } } })
    await audit(session.staffName || "Staff", session.staffRole, "PAYMENT_REQUESTED", "Order", order.reference, `M-Pesa request created by ${session.staffRole}`)
    await notifyCustomer(order.userId, "PAYMENT", `Payment request — ${order.reference}`, `An M-Pesa prompt for KSh ${amount.toLocaleString()} was sent to your phone.`, "IN_APP", { link: `${process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"}/orders/${id}`, metadata: { orderId: id, reference: order.reference, amount } })
    return NextResponse.json({ paymentId: payment.id, checkoutRequestId: result.checkoutRequestId, phone, amount, message: result.customerMessage })
  } catch {
    await db.payment.updateMany({ where: { id: payment.id, status: "PROCESSING" }, data: { status: "PROCESSING", failureReason: "Provider response uncertain; reconcile before another attempt" } })
    return NextResponse.json({ error: "M-Pesa response is uncertain. Check payment status before another request." }, { status: 503 })
  }
}
