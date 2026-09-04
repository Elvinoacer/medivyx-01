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
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json(promos.map(toPromotionDTO))
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

    const code = body.code ? String(body.code).trim().toUpperCase() : null
    if (code && !/^[A-Z0-9_-]{3,32}$/.test(code)) return NextResponse.json({ error: "Promotion codes must be 3–32 letters, numbers, underscores or hyphens." }, { status: 400 })
    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null
    const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null
    if (startsAt && Number.isNaN(startsAt.getTime()) || endsAt && Number.isNaN(endsAt.getTime()) || startsAt && endsAt && endsAt <= startsAt) return NextResponse.json({ error: "Promotion dates are invalid or reversed." }, { status: 400 })
    const maximum = body.maxUses == null || body.maxUses === "" ? null : Math.trunc(Number(body.maxUses))
    const perUser = body.perUserLimit == null || body.perUserLimit === "" ? null : Math.trunc(Number(body.perUserLimit))
    const minimumSpend = body.minimumSpend == null || body.minimumSpend === "" ? null : Number(body.minimumSpend)
    if (maximum != null && (!Number.isSafeInteger(maximum) || maximum < 1) || perUser != null && (!Number.isSafeInteger(perUser) || perUser < 1) || minimumSpend != null && (!Number.isFinite(minimumSpend) || minimumSpend < 0)) return NextResponse.json({ error: "Promotion limits are invalid." }, { status: 400 })
    const discountPct = body.discountPct == null || body.discountPct === "" ? null : Number(body.discountPct)
    if (discountPct != null && (!Number.isSafeInteger(discountPct) || discountPct < 1 || discountPct > 90)) return NextResponse.json({ error: "Discount must be a whole percentage from 1 to 90." }, { status: 400 })
    const promo = await db.promotion.create({
      data: {
        title,
        description,
        badge: body.badge ? String(body.badge).trim().slice(0, 24) : null,
        code,
        discountPct,
        color: ["teal", "amber", "rose"].includes(body.color) ? body.color : "teal",
        active: body.active !== false,
        startsAt, endsAt, maxUses: maximum, perUserLimit: perUser, minimumSpend,
      },
    })
    await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_CREATED", "Promotion", promo.id, title)
    return NextResponse.json(toPromotionDTO(promo))
  } catch {
    return NextResponse.json({ error: "Could not create the promotion." }, { status: 500 })
  }
}
