import { isUniqueConstraintError } from "@/lib/security/request"
import { promotionCode, promotionDate, promotionDiscount, promotionLimitFields } from "@/lib/promotions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPromotionDTO } from "@/lib/dto"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { rejectOversizedRequest } from "@/lib/security/request"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const all = url.searchParams.get("all") === "1"
  if (all) {
    const { error } = await requireStaff(["ADMIN", "STAFF"])
    if (error) return error
  }
  const now = new Date()
  const promos = await db.promotion.findMany({
    where: all
      ? {}
      : {
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
    include: all ? { _count: { select: { redemptions: true } } } : undefined,
    orderBy: { createdAt: "desc" },
    take: all ? 500 : 100,
  })
  const visible = all ? promos : promos.filter(p => !p.code || p.maxUses == null || !("_count" in p) || (p._count as {redemptions:number}).redemptions < p.maxUses)
  return NextResponse.json(visible.map(p => ({
    ...toPromotionDTO(p),
    ...(all && "_count" in p ? { usageCount: (p._count as { redemptions:number }).redemptions } : {}),
  })), { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: Request) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF"])
  if (error) return error
  const oversized = rejectOversizedRequest(request, 16_384)
  if (oversized) return oversized
  try {
    const body = await request.json()
    const title = String(body.title ?? "").trim()
    const description = String(body.description ?? "").trim()
    if (title.length < 3 || title.length > 160) return NextResponse.json({ error: "Promotion title must be 3–160 characters." }, { status: 400 })
    if (description.length < 5 || description.length > 2_000) return NextResponse.json({ error: "Promotion description must be 5–2,000 characters." }, { status: 400 })

    const code = promotionCode(body.code)
    const startsAt = promotionDate(body.startsAt, false)
    const endsAt = promotionDate(body.endsAt, true)
    if (startsAt && endsAt && endsAt < startsAt) return NextResponse.json({error:"End date must be on or after start date.",field:"endsAt"},{status:400})
    const discountPct = promotionDiscount(body.discountPct)
    if (code && !discountPct) return NextResponse.json({error:"Set a discount percentage for this checkout code.",field:"discountPct"},{status:400})
    const limits = promotionLimitFields(body)
    const minimumSpend = body.minimumSpend == null || body.minimumSpend === "" ? null : Number(body.minimumSpend)
    if (minimumSpend != null && (!Number.isFinite(minimumSpend) || minimumSpend < 0 || minimumSpend > 10000000)) return NextResponse.json({error:"Minimum spend must be between KSh 0 and KSh 10,000,000.",field:"minimumSpend"},{status:400})
    const promo = await db.promotion.create({
      data: {
        title,
        description,
        badge: body.badge ? String(body.badge).trim().slice(0, 24) : null,
        code,
        discountPct,
        color: ["teal", "emerald", "amber", "orange", "rose", "violet", "neutral"].includes(body.color) ? body.color : "teal",
        active: body.active !== false,
        startsAt, endsAt, ...limits, minimumSpend,
      },
    })
    await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_CREATED", "Promotion", promo.id, title)
    return NextResponse.json(toPromotionDTO(promo))
  } catch (err) {
    if (isUniqueConstraintError(err)) return NextResponse.json({error:"This promo code is already in use. Generate a new code or choose a different one.",field:"code"},{status:409})
    if (err instanceof Error && /^(Promo code|Choose a valid|Discount must|Total redemption|Per-customer|Per-network|Per-browser)/.test(err.message)) return NextResponse.json({error:err.message},{status:400})
    return NextResponse.json({ error: "Could not create the promotion. Try again or contact support." }, { status: 500 })
  }
}
