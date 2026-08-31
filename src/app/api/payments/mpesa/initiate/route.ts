import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

/** M-Pesa STK Push (Daraja) — simulated in this demo environment.
 *  In production: call Safaricom Daraja STK Push w/ client's registered Paybill + passkey,
 *  then confirm via the Daraja callback endpoint. */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = String(body.orderId ?? "")
    const phoneRaw = String(body.phone ?? "").trim()
    const m = PHONE_RE.exec(phoneRaw.replace(/\s+/g, ""))
    if (!m) return NextResponse.json({ error: "Enter a valid Safaricom number (e.g. 0712 345 678)." }, { status: 400 })
    const phone = `+254${m[1]}`

    const session = await getSession()
    const order = await db.order.findUnique({ where: { id: orderId } })
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

    const isOwner = session?.userId && order.userId === session.userId
    const isStaff = Boolean(session?.staffId)
    if (!isOwner && !isStaff && order.guestPhone !== phone) {
      return NextResponse.json({ error: "You can only pay for your own order." }, { status: 403 })
    }

    const alreadyPaid = await db.payment.findFirst({ where: { orderId, status: "SUCCESS" } })
    if (alreadyPaid) return NextResponse.json({ error: "This order is already paid." }, { status: 400 })

    const checkoutRequestId = `ws_CO_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

    // expire any earlier pending STK pushes for this order
    await db.payment.updateMany({ where: { orderId, status: { in: ["PENDING", "PROCESSING"] }, method: "STK_PUSH" }, data: { status: "FAILED", failureReason: "Superseded by a new request" } })

    const payment = await db.payment.create({
      data: {
        orderId, provider: "MPESA", method: "STK_PUSH", status: "PROCESSING",
        amount: order.total, phone, checkoutRequestId,
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      checkoutRequestId,
      message: `STK Push sent to ${phone}. Enter your M-Pesa PIN on your phone to authorise KSh ${order.total}.`,
    })
  } catch {
    return NextResponse.json({ error: "Could not start the M-Pesa payment. Please try again." }, { status: 500 })
  }
}
