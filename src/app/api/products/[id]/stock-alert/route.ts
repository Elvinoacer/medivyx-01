import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireCustomer } from "@/lib/session"

type Params = { params: Promise<{ id: string }> }

// POST /api/products/[id]/stock-alert — customer asks to be told when back in stock
export async function POST(_request: Request, { params }: Params) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product || !product.active) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 })
  }
  if (product.stockStatus === "IN_STOCK" || product.stockStatus === "LOW_STOCK") {
    return NextResponse.json({ error: "This product is in stock right now." }, { status: 400 })
  }
  const existing = await db.productAlert.findUnique({
    where: { productId_userId: { productId: id, userId: session.userId! } },
  })
  if (existing && !existing.notifiedAt) {
    return NextResponse.json({ error: "You're already watching this product." }, { status: 409 })
  }
  // a previously-notified watcher can re-arm the alert
  const alert = existing
    ? await db.productAlert.update({ where: { id: existing.id }, data: { notifiedAt: null } })
    : await db.productAlert.create({ data: { productId: id, userId: session.userId! } })
  return NextResponse.json(
    {
      id: alert.id,
      productId: product.id,
      productName: product.name,
      active: true,
      createdAt: alert.createdAt.toISOString(),
    },
    { status: 201 }
  )
}
