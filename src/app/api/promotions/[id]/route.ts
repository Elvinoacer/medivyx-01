import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPromotionDTO } from "@/lib/dto"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF"])
  if (error) return error
  const { id } = await params
  const promo = await db.promotion.findUnique({ where: { id } })
  if (!promo) return NextResponse.json({ error: "Promotion not found." }, { status: 404 })
  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = String(body.title).trim()
    if (body.description !== undefined) data.description = String(body.description).trim()
    if (body.badge !== undefined) data.badge = body.badge ? String(body.badge).trim().slice(0, 24) : null
    if (body.code !== undefined) data.code = body.code ? String(body.code).trim().toUpperCase().slice(0, 16) : null
    if (body.discountPct !== undefined) {
      data.discountPct = body.discountPct != null && body.discountPct !== "" ? Math.max(1, Math.min(90, Math.trunc(Number(body.discountPct)) || 0)) : null
    }
    if (body.color !== undefined && ["teal", "amber", "rose"].includes(body.color)) data.color = body.color
    if (body.active !== undefined) data.active = Boolean(body.active)
    if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(String(body.startsAt)) : null
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(String(body.endsAt)) : null

    const updated = await db.promotion.update({ where: { id }, data })
    await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_UPDATED", "Promotion", id, updated.title)
    return NextResponse.json(toPromotionDTO(updated))
  } catch {
    return NextResponse.json({ error: "Could not update the promotion." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF"])
  if (error) return error
  const { id } = await params
  const promo = await db.promotion.findUnique({ where: { id } })
  if (!promo) return NextResponse.json({ error: "Promotion not found." }, { status: 404 })
  await db.promotion.delete({ where: { id } })
  await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_DELETED", "Promotion", id, promo.title)
  return NextResponse.json({ ok: true })
}
