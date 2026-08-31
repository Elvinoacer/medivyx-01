import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireCustomer } from "@/lib/session"

// GET /api/products/stock-alerts — the signed-in customer's watch list
export async function GET() {
  const { session, error } = await requireCustomer()
  if (error) return error
  const alerts = await db.productAlert.findMany({
    where: { userId: session.userId! },
    include: { product: { select: { id: true, name: true, stockStatus: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(
    alerts.map((a) => ({
      id: a.id,
      productId: a.productId,
      productName: a.product.name,
      active: a.notifiedAt === null,
      createdAt: a.createdAt.toISOString(),
    }))
  )
}

// DELETE /api/products/stock-alerts?id=... — stop watching a product
export async function DELETE(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const id = new URL(request.url).searchParams.get("id")?.trim()
  if (!id) return NextResponse.json({ error: "Alert id is required." }, { status: 400 })
  const alert = await db.productAlert.findUnique({ where: { id } })
  if (!alert || alert.userId !== session.userId) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 })
  }
  await db.productAlert.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
