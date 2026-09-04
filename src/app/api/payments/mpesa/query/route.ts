import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { tokenHash } from "@/lib/hash"
import { enforceRateLimit } from "@/lib/security/request"
import { getSession } from "@/lib/session"

// Read-only status endpoint. Provider reconciliation is performed only by authenticated callbacks/jobs.
export async function GET(request: Request) {
  const checkoutRequestId = new URL(request.url).searchParams.get("checkoutRequestId") || ""
  if (!checkoutRequestId) return NextResponse.json({ error: "checkoutRequestId is required." }, { status: 400 })
  const limited = await enforceRateLimit(request, "mpesa-status", 40, 10 * 60 * 1000, checkoutRequestId)
  if (limited) return limited
  const payment = await db.payment.findUnique({ where: { provider_checkoutRequestId: { provider: "MPESA", checkoutRequestId } }, include: { order: true } })
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 })
  const session = await getSession()
  const accessToken = request.headers.get("x-order-access-token") || ""
  const guestAllowed = Boolean(accessToken && payment.order.guestAccessTokenHash === tokenHash(accessToken) && payment.order.guestAccessExpiresAt && payment.order.guestAccessExpiresAt > new Date())
  const staffAllowed = Boolean(session?.staffId && (session.staffRole !== "RIDER" || payment.order.riderId === session.staffId))
  if (!(session?.userId === payment.order.userId || staffAllowed || guestAllowed)) return NextResponse.json({ error: "You cannot view this payment." }, { status: 403 })
  const status = payment.status === "SUCCESS" ? "SUCCESS" : payment.status === "FAILED" ? "FAILED" : "PENDING"
  return NextResponse.json({ status, payment: { id: payment.id, status: payment.status, reference: payment.providerReference || undefined, failureReason: payment.failureReason || undefined }, orderStatus: payment.order.status }, { headers: { "Cache-Control": "private, no-store" } })
}
