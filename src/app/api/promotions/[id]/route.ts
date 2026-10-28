import { isUniqueConstraintError } from "@/lib/security/request"
import { promotionCode, promotionDate, promotionDiscount, promotionLimitFields } from "@/lib/promotions"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPromotionDTO } from "@/lib/dto"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { rejectOversizedRequest } from "@/lib/security/request"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF"])
  if (error) return error
  const oversized = rejectOversizedRequest(request, 16_384)
  if (oversized) return oversized
  const { id } = await params
  const promo = await db.promotion.findUnique({ where: { id } })
  if (!promo) return NextResponse.json({ error: "Promotion not found." }, { status: 404 })
  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) { const value = String(body.title).trim(); if (value.length < 3 || value.length > 160) return NextResponse.json({ error: "Promotion title must be 3–160 characters." }, { status: 400 }); data.title = value }
    if (body.description !== undefined) { const value = String(body.description).trim(); if (value.length < 5 || value.length > 2_000) return NextResponse.json({ error: "Promotion description must be 5–2,000 characters." }, { status: 400 }); data.description = value }
    if (body.badge !== undefined) data.badge = body.badge ? String(body.badge).trim().slice(0, 24) : null
    if (body.code !== undefined) data.code = promotionCode(body.code)
    if (body.discountPct !== undefined) data.discountPct = promotionDiscount(body.discountPct)
    if (body.color !== undefined && ["teal","emerald","amber","orange","rose","violet","neutral"].includes(body.color)) data.color = body.color
    if (body.isPublic !== undefined) {
      if (typeof body.isPublic !== "boolean") return NextResponse.json({error:"Visibility must be public or private."},{status:400})
      data.isPublic = body.isPublic
    }
    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return NextResponse.json({ error: "Active must be true or false." }, { status: 400 })
      data.active = body.active
    }
    if (body.startsAt !== undefined) data.startsAt = promotionDate(body.startsAt, false)
    if (body.endsAt !== undefined) data.endsAt = promotionDate(body.endsAt, true)
    Object.assign(data,promotionLimitFields(body))
    if (body.minimumSpend !== undefined) {
      const value = body.minimumSpend == null || body.minimumSpend === "" ? null : Number(body.minimumSpend)
      if (value != null && (!Number.isFinite(value) || value < 0 || value > 10000000)) return NextResponse.json({ error: "Minimum spend must be between KSh 0 and KSh 10,000,000.",field:"minimumSpend" }, { status: 400 })
      data.minimumSpend = value
    }
    const nextStart = (data.startsAt === undefined ? promo.startsAt : data.startsAt) as Date | null
    const nextEnd = (data.endsAt === undefined ? promo.endsAt : data.endsAt) as Date | null
    if (nextStart && Number.isNaN(nextStart.getTime()) || nextEnd && Number.isNaN(nextEnd.getTime()) || nextStart && nextEnd && nextEnd <= nextStart) return NextResponse.json({ error: "Promotion dates are invalid or reversed." }, { status: 400 })

    const nextCode = (data.code === undefined ? promo.code : data.code) as string|null
    const nextPct = (data.discountPct === undefined ? promo.discountPct : data.discountPct) as number|null
    if ((data.isPublic === undefined ? promo.isPublic : data.isPublic) === false && !nextCode) return NextResponse.json({error:"Private promotions require a redeemable code.",field:"code"},{status:400})
    if (nextCode && !nextPct) return NextResponse.json({error:"A checkout code needs a percentage discount.",field:"discountPct"},{status:400})
    const updated = await db.promotion.update({ where: { id }, data })
    await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_UPDATED", "Promotion", id, updated.title)
    return NextResponse.json(toPromotionDTO(updated))
  } catch (err) {
    if (isUniqueConstraintError(err)) return NextResponse.json({error:"This promo code belongs to another promotion.",field:"code"},{status:409})
    if (err instanceof Error && /^(Promo code|Choose a valid|Discount must|Total redemption|Per-customer|Per-network|Per-browser)/.test(err.message)) return NextResponse.json({error:err.message},{status:400})
    return NextResponse.json({ error: "Could not update the promotion. Try again." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF"])
  if (error) return error
  const { id } = await params
  const promo = await db.promotion.findUnique({ where: { id } })
  if (!promo) return NextResponse.json({ error: "Promotion not found." }, { status: 404 })
  // Do not erase redemption history that is needed to enforce limits.
  const redemptions = await db.promotionRedemption.count({where:{promotionId:id}})
  if(redemptions>0) {
    await db.promotion.update({where:{id},data:{active:false}})
    await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_ARCHIVED", "Promotion", id, promo.title)
    return NextResponse.json({ok:true,archived:true})
  }
  await db.promotion.delete({ where: { id } })
  await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_DELETED", "Promotion", id, promo.title)
  return NextResponse.json({ ok: true })
}
