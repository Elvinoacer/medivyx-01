import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toReviewDTO } from "@/lib/dto"
import { requireCustomer } from "@/lib/session"

type Params = { params: Promise<{ id: string }> }

// GET /api/products/[id]/reviews — summary + list (public, published only;
// the signed-in customer's own review is included with its moderation status)
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product || !product.active) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 })
  }
  const reviews = await db.review.findMany({
    where: { productId: id, status: "PUBLISHED" },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  const aggregates = await db.review.groupBy({ by: ["rating"], where: { productId: id, status: "PUBLISHED" }, _count: { _all: true } })
  const publicReviews = reviews
  const breakdown = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: aggregates.find((row) => row.rating === rating)?._count._all || 0,
  }))
  const count = breakdown.reduce((sum, row) => sum + row.count, 0)
  const average = count ? breakdown.reduce((sum, row) => sum + row.rating * row.count, 0) / count : 0

  const { getSession } = await import("@/lib/session")
  const session = await getSession()
  let mine: (ReturnType<typeof toReviewDTO> & { status: string }) | null = null
  if (session?.userId) {
    const own = await db.review.findUnique({ where: { productId_userId: { productId: id, userId: session.userId } }, include: { user: { select: { name: true } } } })
    if (own) mine = { ...toReviewDTO(own), status: own.status }
  }

  return NextResponse.json({
    average: Math.round(average * 10) / 10,
    count,
    breakdown,
    reviews: publicReviews.map(toReviewDTO),
    mine,
  })
}

// POST /api/products/[id]/reviews — customer leaves a rating (1-5) + optional comment
export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const { id } = await params
  const product = await db.product.findUnique({ where: { id } })
  if (!product || !product.active) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 })
  }
  try {
    const body = await request.json()
    const rating = Math.trunc(Number(body.rating))
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating must be between 1 and 5 stars." }, { status: 400 })
    }
    const comment = body.comment ? String(body.comment).trim().slice(0, 500) : null
    if (comment && comment.length < 3) {
      return NextResponse.json({ error: "Review text is too short." }, { status: 400 })
    }
    const existing = await db.review.findUnique({
      where: { productId_userId: { productId: id, userId: session.userId! } },
    })
    if (existing) {
      return NextResponse.json(
        { error: "You've already reviewed this product." },
        { status: 409 }
      )
    }
    const purchased = await db.orderItem.findFirst({
      where: { productId: id, order: { userId: session.userId, status: { in: ["COMPLETED_PICKUP", "COMPLETED_DELIVERY"] } } },
      select: { id: true },
    })
    if (!purchased) return NextResponse.json({ error: "Reviews are available after a completed purchase." }, { status: 403 })
    const review = await db.review.create({
      data: { productId: id, userId: session.userId!, rating, comment },
      include: { user: { select: { name: true } } },
    })
    return NextResponse.json(toReviewDTO(review), { status: 201 })
  } catch {
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 })
  }
}
