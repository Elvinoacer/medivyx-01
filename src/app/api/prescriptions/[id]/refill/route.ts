import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { ORDER_INCLUDE, toOrderDTO } from "@/lib/dto"
import { orderReference, pickupCode } from "@/lib/hash"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
import { requireCustomer } from "@/lib/session"

type Params = { params: Promise<{ id: string }> }

/** FR-5.5 — request a refill of a previously approved prescription (re-verification applies). */
export async function POST(_request: Request, { params }: Params) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const { id } = await params

  const rx = await db.prescription.findUnique({ where: { id }, include: { order: { include: { items: true } } } })
  if (!rx || rx.userId !== session.userId) {
    return NextResponse.json({ error: "Prescription not found." }, { status: 404 })
  }
  if (rx.status !== "APPROVED" && rx.status !== "PARTIALLY_APPROVED") {
    return NextResponse.json({ error: "Only approved prescriptions can be refilled." }, { status: 400 })
  }
  if (rx.refillsUsed >= rx.refillsAllowed) {
    return NextResponse.json({ error: "No refills remaining on this prescription. Upload a new one from your doctor." }, { status: 400 })
  }
  if (rx.validUntil && rx.validUntil < new Date()) {
    return NextResponse.json({ error: "This prescription has expired. Upload a new one from your doctor." }, { status: 400 })
  }
  const sourceOrder = rx.order
  if (!sourceOrder || sourceOrder.items.length === 0) {
    return NextResponse.json({ error: "No items found to refill for this prescription." }, { status: 400 })
  }

  // verify current product availability at today's prices
  const productIds = sourceOrder.items.map((i) => i.productId).filter((p): p is string => Boolean(p))
  const products = await db.product.findMany({ where: { id: { in: productIds } } })
  const lines = sourceOrder.items
    .map((item) => ({ item, product: products.find((p) => p.id === item.productId) }))
    .filter(
      (l): l is { item: (typeof sourceOrder.items)[number]; product: (typeof products)[number] } =>
        Boolean(l.product) && l.product!.active && l.product!.stockStatus !== "OUT_OF_STOCK" && l.product!.stockStatus !== "DISCONTINUED"
    )
  if (lines.length === 0) {
    return NextResponse.json({ error: "The items on this prescription are currently unavailable. WhatsApp us and we'll suggest alternatives." }, { status: 400 })
  }

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.item.qty, 0)
  const fulfillment = sourceOrder.fulfillment
  const reference = orderReference()

  // clone prescription record for re-verification (new review cycle)
  const refillRx = await db.prescription.create({
    data: {
      userId: rx.userId,
      fileName: rx.fileName,
      fileType: rx.fileType,
      fileData: rx.fileData,
      notes: `Refill request of prescription ${rx.id.slice(-6).toUpperCase()} — awaiting re-verification`,
      status: "PENDING",
      refillsAllowed: 0,
    },
  })

  const order = await db.order.create({
    data: {
      reference,
      userId: rx.userId,
      type: "PRESCRIPTION",
      status: "RECEIVED",
      fulfillment,
      subtotal,
      total: subtotal,
      pickupCode: fulfillment === "PICKUP" ? pickupCode() : null,
      deliveryAddress: sourceOrder.deliveryAddress,
      deliveryArea: sourceOrder.deliveryArea,
      notes: `Refill of order ${sourceOrder.reference}`,
      items: {
        create: lines.map((l) => ({
          productId: l.product.id,
          name: l.product.name,
          price: l.product.price,
          qty: l.item.qty,
          requiresPrescription: true,
          lineTotal: l.product.price * l.item.qty,
        })),
      },
    },
  })

  await db.prescription.update({ where: { id: refillRx.id }, data: { orderId: order.id } })
  await db.prescription.update({ where: { id: rx.id }, data: { refillsUsed: { increment: 1 } } })

  await db.order.update({ where: { id: order.id }, data: { status: "UNDER_REVIEW" } })
  await addStatusEvent(order.id, "RECEIVED", "System", "Refill request received")
  await addStatusEvent(order.id, "UNDER_REVIEW", "System", "Queued for pharmacist re-verification")

  await audit("System", null, "RX_REFILL_REQUESTED", "Prescription", rx.id, `New order ${reference}`)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
  const orderUrl = `${appUrl}/#order-${order.id}`

  const customerUser = rx.userId
    ? await db.user.findUnique({ where: { id: rx.userId }, select: { name: true, email: true } })
    : null
  const customerName = customerUser?.name || "Customer"

  await notifyCustomer(
    rx.userId,
    "PRESCRIPTION",
    `Refill requested — order ${reference}`,
    "We received your refill request. Our pharmacist will re-verify and confirm availability shortly.",
    "IN_APP",
    {
      link: orderUrl,
      metadata: { orderId: order.id, prescriptionId: rx.id, reference },
      email: customerUser?.email
        ? {
            to: customerUser.email,
            subject: `Refill Requested: Order ${reference} — Sphere Pharmacy`,
            html: `<p>Hello ${customerName},</p><p>We received your prescription refill request for order <strong>${reference}</strong>.</p><p>Our pharmacist is re-verifying the prescription and will confirm medication availability shortly.</p><p><a href="${orderUrl}">Track order progress</a></p>`,
            text: `Refill request received for order ${reference}.\nTrack order: ${orderUrl}`,
          }
        : undefined,
    }
  )

  // Alert pharmacists
  const { notifyStaff } = await import("@/lib/notify")
  await notifyStaff({
    roles: ["PHARMACIST", "ADMIN"],
    event: "RX_REFILL_REQUESTED",
    title: `Prescription Refill: ${reference}`,
    message: `Customer ${customerName} requested a refill for prescription ${rx.fileName}. Re-verification required.`,
    link: `${appUrl}/#admin-prescriptions`,
    details: {
      "Order Ref": reference,
      Customer: customerName,
      Prescription: rx.fileName,
      RemainingRefills: rx.refillsAllowed - rx.refillsUsed - 1,
    },
  })

  const full = await db.order.findUnique({ where: { id: order.id }, include: ORDER_INCLUDE })
  return NextResponse.json({ orderId: order.id, reference, order: toOrderDTO(full!) })
}
