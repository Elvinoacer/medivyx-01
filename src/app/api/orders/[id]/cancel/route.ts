import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer, statusNotification } from "@/lib/notify"
import { getSession } from "@/lib/session"
import { reversePointsForOrder } from "@/lib/loyalty"

type Params = { params: Promise<{ id: string }> }

const CANCELLABLE = ["RECEIVED", "UNDER_REVIEW", "PRESCRIPTION_VERIFIED", "AVAILABILITY_CONFIRMED", "AWAITING_PAYMENT"]

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 })

  const order = await db.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  const isOwner = session.userId && order.userId === session.userId
  const isStaff = Boolean(session.staffId)
  if (!isOwner && !isStaff) return NextResponse.json({ error: "You can only cancel your own orders." }, { status: 403 })
  if (!CANCELLABLE.includes(order.status)) {
    return NextResponse.json({ error: "This order can no longer be cancelled — it's already being prepared. Call or WhatsApp us if you need help." }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const reason = body.reason ? String(body.reason).trim() : undefined
  const actor = isStaff ? (session.staffName ?? "Staff") : (order.user?.name ?? "Customer")

  await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } })
  await addStatusEvent(order.id, "CANCELLED", actor, reason ? `Cancelled: ${reason}` : "Cancelled by customer")

  // refund any captured payment
  await db.payment.updateMany({ where: { orderId: order.id, status: "SUCCESS" }, data: { status: "REFUNDED" } })

  // return any redeemed Sphere Points to the customer's balance
  await reversePointsForOrder(order.id, actor)

  await audit(actor, isStaff ? session.staffRole : null, "ORDER_CANCELLED", "Order", order.reference, reason ?? undefined)
  const { title, message } = statusNotification("CANCELLED", order.reference)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
  const orderUrl = `${appUrl}/#order-${order.id}`

  const customerUser = order.userId
    ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true } })
    : null
  const customerName = customerUser?.name || order.guestName || "Valued Customer"
  const customerEmail = customerUser?.email

  await notifyCustomer(order.userId, "ORDER_STATUS", title, message, "IN_APP", {
    link: orderUrl,
    metadata: { orderId: order.id, status: "CANCELLED", reference: order.reference, reason },
    email: customerEmail
      ? {
          to: customerEmail,
          subject: `Order Cancelled: ${order.reference} — Sphere Pharmacy`,
          html: `<p>Hello ${customerName},</p><p>Your order <strong>${order.reference}</strong> has been cancelled.${reason ? ` Reason: ${reason}` : ""}</p><p>Any points or payments have been reversed. If you have questions, please contact our pharmacy desk.</p>`,
          text: `Hello ${customerName},\nYour order ${order.reference} has been cancelled.${reason ? ` Reason: ${reason}` : ""}\nAny payments or points have been reversed.`,
        }
      : undefined,
  })

  // Alert Admins & Staff
  const { notifyStaff } = await import("@/lib/notify")
  await notifyStaff({
    roles: ["ADMIN", "STAFF", "PHARMACIST"],
    event: "ORDER_CANCELLED",
    title: `Order Cancelled: ${order.reference}`,
    message: `Order ${order.reference} was cancelled by ${actor}.${reason ? ` Reason: ${reason}` : ""}`,
    link: `${appUrl}/#admin-orders`,
    details: {
      "Order Ref": order.reference,
      CancelledBy: actor,
      Reason: reason || "Customer request",
      Total: `KSh ${order.total.toLocaleString()}`,
    },
  })

  const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
  return NextResponse.json(toOrderDTO(updated!))
}
