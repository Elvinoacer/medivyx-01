import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
import type { AdminReviewDTO } from "@/lib/types"

type DbReview = {
  id: string; productId: string; userId: string; rating: number; comment: string | null;
  status: string; createdAt: Date;
  product: { name: string; sku: string } | null;
  user: { name: string | null; email: string | null; phone: string | null } | null;
}

function toAdminReviewDTO(r: DbReview): AdminReviewDTO {
  return {
    id: r.id,
    productId: r.productId,
    productName: r.product?.name ?? "Unknown product",
    productSku: r.product?.sku ?? "—",
    userId: r.userId,
    authorName: r.user?.name?.trim() || "Customer",
    authorEmail: r.user?.email ?? null,
    authorPhone: r.user?.phone ?? null,
    rating: r.rating,
    comment: r.comment,
    status: r.status as AdminReviewDTO["status"],
    createdAt: r.createdAt.toISOString(),
  }
}

// GET /api/admin/reviews — moderation queue (?status=PUBLISHED|HIDDEN, default all)
export async function GET(request: Request) {
  const { error } = await requireStaff(["ADMIN", "PHARMACIST"])
  if (error) return error
  const status = new URL(request.url).searchParams.get("status")?.trim()
  const reviews = await db.review.findMany({
    where: status ? { status } : undefined,
    include: { product: { select: { name: true, sku: true } }, user: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  })
  return NextResponse.json(reviews.map(toAdminReviewDTO))
}
