import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { DISPATCH_STATUSES } from "@/lib/constants"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF", "PHARMACIST"])
  if (error) return error
  const { id } = await params
  const order = await db.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  if (order.fulfillment !== "DELIVERY") {
    return NextResponse.json({ error: "Riders can only be assigned to delivery orders." }, { status: 400 })
  }

  if (!DISPATCH_STATUSES.includes(order.status as (typeof DISPATCH_STATUSES)[number])) {
    return NextResponse.json({ error: "Only active delivery orders can be assigned or reassigned." }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const staffId = String(body.staffId ?? "")
  const rider = await db.staffUser.findUnique({ where: { id: staffId } })
  if (!rider || rider.role !== "RIDER" || !rider.active) {
    return NextResponse.json({ error: "Select an active rider account." }, { status: 400 })
  }

  if (order.riderId === rider.id) return NextResponse.json(toOrderDTO(order))
  const actor = session.staffName ?? "Staff"
  const updatedCount = await db.order.updateMany({
    where: { id: order.id, version: order.version, status: order.status },
    data: { riderId: rider.id, riderName: rider.name, version: { increment: 1 } },
  })
  if (updatedCount.count !== 1) return NextResponse.json({ error: "This delivery changed. Refresh and try assigning again." }, { status: 409 })
  await addStatusEvent(order.id, order.status, actor, order.riderName ? `Rider reassigned: ${order.riderName} → ${rider.name}` : `Rider assigned: ${rider.name}`)
  await audit(actor, session.staffRole, "RIDER_ASSIGNED", "Order", order.reference, `${rider.name} → ${order.reference}`)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
  const orderUrl = `${appUrl}/#order-${order.id}`

  const customerUser = order.userId
    ? await db.user.findUnique({ where: { id: order.userId }, select: { name: true, email: true } })
    : null
  const customerEmail = customerUser?.email

  await notifyCustomer(
    order.userId,
    "ORDER_STATUS",
    `Rider assigned — order ${order.reference}`,
    `${rider.name} will deliver your order.`,
    "IN_APP",
    {
      link: orderUrl,
      metadata: { orderId: order.id, reference: order.reference, riderName: rider.name },
      email: customerEmail
        ? {
            to: customerEmail,
            subject: `Rider Assigned: Order ${order.reference} — Sphere Pharmacy`,
            html: `<p>Hello ${customerUser?.name || order.guestName || "Customer"},</p><p>Great news! Rider <strong>${rider.name}</strong> has been assigned to deliver your order <strong>${order.reference}</strong>.</p><p>Delivery address: <strong>${order.deliveryAddress ?? "Your saved address"}</strong> (${order.deliveryArea ?? ""})</p><p><a href="${orderUrl}">Track your delivery</a></p>`,
            text: `Rider ${rider.name} has been assigned to deliver your order ${order.reference}.\nTrack order: ${orderUrl}`,
          }
        : undefined,
    }
  )

  // Notify the Rider via Push + Email
  const { notifyStaff } = await import("@/lib/notify")
  await notifyStaff({
    staffId: rider.id,
    event: "NEW_DELIVERY_ASSIGNED",
    title: `New Delivery Assigned: ${order.reference}`,
    message: `You have been assigned order ${order.reference} for delivery to ${order.deliveryAddress ?? "address"} (${order.deliveryArea ?? ""}).`,
    link: `${appUrl}/#admin-dispatch`,
    details: {
      "Order Ref": order.reference,
      Customer: customerUser?.name || order.guestName || "Customer",
      Phone: customerUser?.name ? (order.guestPhone ?? "Registered User") : (order.guestPhone ?? "N/A"),
      Address: order.deliveryAddress ?? "Counter",
      Total: `KSh ${order.total.toLocaleString()}`,
    },
  })

  const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
  return NextResponse.json(toOrderDTO(updated!))
}
