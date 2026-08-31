import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { awardPointsForOrder } from "@/lib/loyalty"

type Params = { params: Promise<{ id: string }> }

/** Staff confirms cash was received (on pickup or delivery) → PAID. */
export async function POST(_request: Request, { params }: Params) {
  const { session, error } = await requireStaff()
  if (error) return error
  const { id } = await params
  const order = await db.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })
  if (order.status === "PAID" || order.status.startsWith("COMPLETED")) {
    return NextResponse.json(toOrderDTO(order))
  }

  const actor = session.staffName ?? "Staff"
  const existingCash = await db.payment.findFirst({ where: { orderId: order.id, provider: "CASH" } })
  if (existingCash) {
    await db.payment.update({ where: { id: existingCash.id }, data: { status: "SUCCESS" } })
  } else {
    await db.payment.create({
      data: {
        orderId: order.id, provider: "CASH", method: order.fulfillment === "DELIVERY" ? "CASH_ON_DELIVERY" : "CASH_ON_PICKUP",
        status: "SUCCESS", amount: order.total,
      },
    })
  }
  await db.order.update({ where: { id: order.id }, data: { status: "PAID" } })
  await addStatusEvent(order.id, "PAID", actor, "Cash payment received")
  await audit(actor, session.staffRole, "CASH_CONFIRMED", "Order", order.reference, `KSh ${order.total} received in cash`)
  const earned = await awardPointsForOrder(order.id)
  await notifyCustomer(order.userId, "PAYMENT", `Payment received — order ${order.reference}`, `Thank you! Your cash payment was received.${earned > 0 ? ` You earned ${earned} Sphere Points.` : ""}`)
  const updated = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
  return NextResponse.json(toOrderDTO(updated!))
}
