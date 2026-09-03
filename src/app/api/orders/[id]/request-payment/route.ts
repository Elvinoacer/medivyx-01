import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { requireStaff } from "@/lib/session"
import { initiateStkPush, formatDarajaPhone } from "@/lib/mpesa/daraja"
import { audit, notifyCustomer } from "@/lib/notify"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

type Params = { params: Promise<{ id: string }> }

/**
 * Staff & Rider endpoint to trigger an M-Pesa STK push prompt to a customer.
 * Used for:
 * 1. Rider collecting payment at delivery.
 * 2. Pharmacist requesting payment after verifying a prescription.
 * 3. Store staff requesting payment over phone or counter.
 */
export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF", "PHARMACIST", "RIDER"])
  if (error) return error

  const { id } = await params
  const order = await db.order.findUnique({
    where: { id },
    include: {
      ...ORDER_INCLUDE,
      user: { select: { name: true, phone: true, email: true } },
    },
  })

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 })

  if (order.status === "PAID" || order.status.startsWith("COMPLETED")) {
    return NextResponse.json({ error: "This order is already paid." }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  // Phone can be provided in body (e.g. if customer changed phone on delivery) or use order/user phone
  const rawPhone = String(body.phone || order.guestPhone || order.user?.phone || "").trim()
  const m = PHONE_RE.exec(rawPhone.replace(/\s+/g, ""))

  if (!m) {
    return NextResponse.json(
      { error: "No valid Safaricom phone number found for this customer. Please enter a valid number (e.g. 0712 345 678)." },
      { status: 400 }
    )
  }

  const phone = `+254${m[1]}`
  const darajaPhone = formatDarajaPhone(phone)
  const actor = session.staffName ?? "Staff"

  try {
    // Expire any earlier pending STK pushes for this order
    await db.payment.updateMany({
      where: { orderId: order.id, status: { in: ["PENDING", "PROCESSING"] }, method: "STK_PUSH" },
      data: { status: "FAILED", failureReason: "Superseded by staff-initiated request" },
    })

    const stkResult = await initiateStkPush({
      phone: darajaPhone,
      amount: order.total,
      reference: order.reference,
      description: `Order ${order.reference}`,
    })

    const payment = await db.payment.create({
      data: {
        orderId: order.id,
        provider: "MPESA",
        method: "STK_PUSH",
        status: "PROCESSING",
        amount: order.total,
        phone,
        checkoutRequestId: stkResult.checkoutRequestId,
      },
    })

    await audit(
      actor,
      session.staffRole,
      "PAYMENT_REQUESTED",
      "Order",
      order.reference,
      `STK Push of KSh ${order.total} sent to ${phone} by ${session.staffRole} ${actor}`
    )

    // Send customer in-app notification & push alert
    await notifyCustomer(
      order.userId,
      "PAYMENT",
      `Payment request — ${order.reference}`,
      `Please check your phone (${phone}). An M-Pesa STK prompt for KSh ${order.total.toLocaleString()} has been sent.`,
      "IN_APP",
      {
        link: `/#order-${order.id}`,
        metadata: { orderId: order.id, reference: order.reference, amount: order.total },
      }
    )

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      checkoutRequestId: stkResult.checkoutRequestId,
      phone,
      amount: order.total,
      message: stkResult.customerMessage,
      simulated: stkResult.simulated ?? false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to initiate M-Pesa STK push."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
