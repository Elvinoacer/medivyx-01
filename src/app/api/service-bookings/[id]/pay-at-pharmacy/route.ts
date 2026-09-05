import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { notifyCustomer, notifyStaff } from "@/lib/notify"
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
  const { id } = await ctx.params
  try {
    await db.$transaction(async tx => {
      const booking = await tx.serviceBooking.findUnique({ where: { id } })
      if (!booking || booking.userId !== session.userId) throw new Error("NOT_FOUND")
      if (booking.paymentStatus === "PAID" || ["CANCELLED", "REJECTED", "COMPLETED", "NO_SHOW"].includes(booking.status)) throw new Error("NOT_PAYABLE")
      if (await tx.servicePayment.findFirst({ where: { bookingId: id, provider: { in: ["MPESA", "INTASEND"] }, status: { in: ["PENDING", "PROCESSING", "SUCCESS"] } } })) throw new Error("NOT_PAYABLE")
      if (booking.paymentStatus === "PAY_AT_PHARMACY") return
      await tx.serviceBooking.update({ where: { id }, data: { paymentStatus: "PAY_AT_PHARMACY" } })
      await tx.servicePayment.upsert({ where: { idempotencyKey: `service:${id}:pay-at-pharmacy` }, create: { bookingId: id, provider: "IN_STORE", method: "PAY_AT_PHARMACY", status: "PENDING", amount: booking.price || 0, currency: "KES", idempotencyKey: `service:${id}:pay-at-pharmacy` }, update: {} })
      await notifyCustomer(booking.userId, "SERVICE_PAYMENT", "Pay at the pharmacy", `You’ve chosen to pay at the pharmacy for appointment ${booking.reference}. No payment has been collected.`, "IN_APP", { transaction: tx, dedupeKey: `in-store:${id}`, link: "/services?tab=bookings" })
      await notifyStaff({ transaction: tx, dedupeKey: `in-store:${id}`, roles: ["ADMIN", "STAFF"], event: "SERVICE_PAY_AT_PHARMACY", title: "Payment due at pharmacy", message: `Appointment ${booking.reference} will be paid in store. Payment is still outstanding.`, link: "/admin/services" })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000, maxWait: 5000 })
    return NextResponse.json({ ok: true, paymentStatus: "PAY_AT_PHARMACY" })
  } catch (error) {
    const missing = error instanceof Error && error.message === "NOT_FOUND"
    return NextResponse.json({ error: missing ? "Booking not found." : "This booking changed or has a payment in progress. Refresh before changing payment method." }, { status: missing ? 404 : 409 })
  }
}
