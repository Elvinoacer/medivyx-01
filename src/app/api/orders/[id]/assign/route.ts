import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
import { requireStaff } from "@/lib/session"

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

  const body = await request.json().catch(() => ({}))
  const staffId = String(body.staffId ?? "")
  const rider = await db.staffUser.findUnique({ where: { id: staffId } })
  if (!rider || rider.role !== "RIDER" || !rider.active) {
    return NextResponse.json({ error: "Select an active rider account." }, { status: 400 })
  }

  const actor = session.staffName ?? "Staff"
  await db.order.update({ where: { id: order.id }, data: { riderId: rider.id, riderName: rider.name } })
  await addStatusEvent(order.id, order.status, actor, `Rider assigned: ${rider.name}`)
  await audit(actor, session.staffRole, "RIDER_ASSIGNED", "Order", order.reference, `${rider.name} → ${order.reference}`)
  await notifyCustomer(order.userId, "ORDER_STATUS", `Rider assigned — order ${order.reference}`, `${rider.name} will deliver your order.`)
  const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
  return NextResponse.json(toOrderDTO(updated!))
}
