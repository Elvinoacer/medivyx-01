import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { initiateStkPush, formatDarajaPhone } from "@/lib/mpesa/daraja"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

/**
 * M-Pesa STK Push (Daraja Lipa Na M-Pesa Online).
 * Triggers an instant prompt on the customer's phone to enter their M-Pesa PIN.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const orderId = String(body.orderId ?? "")
    const phoneRaw = String(body.phone ?? "").trim()
    const m = PHONE_RE.exec(phoneRaw.replace(/\s+/g, ""))
    if (!m) {
      return NextResponse.json({ error: "Enter a valid Safaricom number (e.g. 0712 345 678)." }, { status: 400 })
    }
    const phone = `+254${m[1]}`
    const darajaPhone = formatDarajaPhone(phone)

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

    // Expire earlier pending STK pushes for this order
    await db.payment.updateMany({
      where: { orderId, status: { in: ["PENDING", "PROCESSING"] }, method: "STK_PUSH" },
      data: { status: "FAILED", failureReason: "Superseded by a new request" },
    })

    // Call Daraja M-Pesa STK Push
    const stkResult = await initiateStkPush({
      phone: darajaPhone,
      amount: order.total,
      reference: order.reference,
      description: `Order ${order.reference}`,
    })

    const payment = await db.payment.create({
      data: {
        orderId,
        provider: "MPESA",
        method: "STK_PUSH",
        status: "PROCESSING",
        amount: order.total,
        phone,
        checkoutRequestId: stkResult.checkoutRequestId,
      },
    })

    return NextResponse.json({
      paymentId: payment.id,
      checkoutRequestId: stkResult.checkoutRequestId,
      merchantRequestId: stkResult.merchantRequestId,
      message: stkResult.customerMessage,
      simulated: stkResult.simulated ?? false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start the M-Pesa payment."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
