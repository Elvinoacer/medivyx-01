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
    if (body.code !== undefined) {
      const code = body.code ? String(body.code).trim().toUpperCase() : null
      if (code && !/^[A-Z0-9_-]{3,32}$/.test(code)) return NextResponse.json({ error: "Promotion code format is invalid." }, { status: 400 })
      data.code = code
    }
    if (body.discountPct !== undefined) {
      const value = body.discountPct == null || body.discountPct === "" ? null : Number(body.discountPct)
      if (value != null && (!Number.isSafeInteger(value) || value < 1 || value > 90)) return NextResponse.json({ error: "Discount must be a whole percentage from 1 to 90." }, { status: 400 })
      data.discountPct = value
    }
    if (body.color !== undefined && ["teal", "amber", "rose"].includes(body.color)) data.color = body.color
    if (body.active !== undefined) {
      if (typeof body.active !== "boolean") return NextResponse.json({ error: "Active must be true or false." }, { status: 400 })
      data.active = body.active
    }
    if (body.startsAt !== undefined) data.startsAt = body.startsAt ? new Date(String(body.startsAt)) : null
    if (body.endsAt !== undefined) data.endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
    for (const key of ["maxUses", "perUserLimit"] as const) if (body[key] !== undefined) {
      const value = body[key] == null || body[key] === "" ? null : Math.trunc(Number(body[key]))
      if (value != null && (!Number.isSafeInteger(value) || value < 1)) return NextResponse.json({ error: `${key} is invalid.` }, { status: 400 })
      data[key] = value
    }
    if (body.minimumSpend !== undefined) {
      const value = body.minimumSpend == null || body.minimumSpend === "" ? null : Number(body.minimumSpend)
      if (value != null && (!Number.isFinite(value) || value < 0)) return NextResponse.json({ error: "Minimum spend is invalid." }, { status: 400 })
      data.minimumSpend = value
    }
    const nextStart = (data.startsAt === undefined ? promo.startsAt : data.startsAt) as Date | null
    const nextEnd = (data.endsAt === undefined ? promo.endsAt : data.endsAt) as Date | null
    if (nextStart && Number.isNaN(nextStart.getTime()) || nextEnd && Number.isNaN(nextEnd.getTime()) || nextStart && nextEnd && nextEnd <= nextStart) return NextResponse.json({ error: "Promotion dates are invalid or reversed." }, { status: 400 })

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
