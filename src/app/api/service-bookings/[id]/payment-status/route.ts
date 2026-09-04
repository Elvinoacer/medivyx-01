import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { enforceRateLimit } from "@/lib/security/request"

/** Read-only status. Provider reconciliation happens only in authenticated callbacks. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  const { id } = await ctx.params
  const limited = await enforceRateLimit(request, "service-payment-status", 40, 10 * 60_000, id)
  if (limited) return limited
  const booking = await db.serviceBooking.findUnique({ where: { id }, include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } } })
  if (!booking || booking.userId !== session.userId) return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  const payment = booking.payments[0]
  return NextResponse.json({ bookingId: id, status: booking.status, paymentStatus: payment?.status || booking.paymentStatus, providerReference: payment?.providerReference || null }, { headers: { "Cache-Control": "private, no-store" } })
}
