import { Prisma } from "@prisma/client"
import { notifyCustomer, notifyStaff } from "@/lib/notify"

export async function notifyPaymentOutcome(tx: Prisma.TransactionClient, input: {
  paymentId: string; orderId?: string; bookingId?: string; success: boolean
}) {
  const order = input.orderId ? await tx.order.findUnique({ where: { id: input.orderId } }) : null
  const booking = input.bookingId ? await tx.serviceBooking.findUnique({ where: { id: input.bookingId } }) : null
  const entity = order || booking
  if (!entity) return
  const reference = entity.reference
  const title = input.success ? `Payment received: ${reference}` : `Payment not completed: ${reference}`
  const message = input.success ? "Thank you. Your payment has been confirmed. Open your account for the details." : "Your payment was not completed. You can review the details and available payment options in your account."
  const link = order ? `/orders/${order.id}` : "/services?tab=bookings"
  const key = `payment:${input.paymentId}:${input.success ? "success" : "failed"}`
  await notifyCustomer(entity.userId, "PAYMENT", title, message, "IN_APP", {
    transaction: tx, dedupeKey: key, link, metadata: { paymentId: input.paymentId },
    email: order?.guestEmail ? { to: order.guestEmail, subject: title, html: `<p>${message}</p>`, text: message } : undefined,
  })
  if (input.success) await notifyStaff({ transaction: tx, dedupeKey: key, roles: ["ADMIN", "PHARMACIST", "STAFF"],
    event: "PAYMENT_RECEIVED", title, message: `Payment confirmed for ${reference}. Review the order or appointment before fulfillment.`,
    link: order ? "/admin/orders" : "/admin/services",
  })
}
