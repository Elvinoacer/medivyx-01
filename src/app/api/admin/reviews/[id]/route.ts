import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
import { audit } from "@/lib/notify"
import { REVIEW_STATUSES } from "@/lib/constants"

type Params = { params: Promise<{ id: string }> }

// PATCH /api/admin/reviews/[id] — publish/hide a customer review (moderation)
export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "PHARMACIST"])
  if (error) return error
  const { id } = await params

  const body = await request.json().catch(() => ({}))
  const status = String(body.status ?? "")
  if (!REVIEW_STATUSES.includes(status as (typeof REVIEW_STATUSES)[number])) {
    return NextResponse.json({ error: "Review status must be PUBLISHED or HIDDEN." }, { status: 400 })
  }

  const review = await db.review.findUnique({
    where: { id },
    include: { product: { select: { name: true, sku: true } }, user: { select: { name: true, email: true, phone: true } } },
  })
  if (!review) return NextResponse.json({ error: "Review not found." }, { status: 404 })

  const updated = await db.review.update({ where: { id }, data: { status } })
  const actor = session.staffName ?? "Staff"
  await audit(
    actor,
    session.staffRole,
    status === "HIDDEN" ? "REVIEW_HIDDEN" : "REVIEW_PUBLISHED",
    "Review",
    review.product?.sku ?? id,
    `${review.rating}★ on ${review.product?.name ?? "product"} is now ${status.toLowerCase()}`
  )

  return NextResponse.json({
    id: updated.id,
    productId: updated.productId,
    productName: review.product?.name ?? "Unknown product",
    productSku: review.product?.sku ?? "—",
    userId: updated.userId,
    authorName: review.user?.name?.trim() || "Customer",
    authorEmail: review.user?.email ?? null,
    authorPhone: review.user?.phone ?? null,
    rating: updated.rating,
    comment: updated.comment,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
  })
}
