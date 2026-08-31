import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPromotionDTO } from "@/lib/dto"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const all = url.searchParams.get("all") === "1"
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
  })
  return NextResponse.json(promos.map(toPromotionDTO))
}

export async function POST(request: Request) {
  const { session, error } = await requireStaff(["ADMIN", "STAFF"])
  if (error) return error
  try {
    const body = await request.json()
    const title = String(body.title ?? "").trim()
    const description = String(body.description ?? "").trim()
    if (title.length < 3) return NextResponse.json({ error: "Give the promotion a title." }, { status: 400 })
    if (description.length < 5) return NextResponse.json({ error: "Add a short description." }, { status: 400 })

    const promo = await db.promotion.create({
      data: {
        title,
        description,
        badge: body.badge ? String(body.badge).trim().slice(0, 24) : null,
        code: body.code ? String(body.code).trim().toUpperCase().slice(0, 16) : null,
        discountPct: body.discountPct != null && body.discountPct !== "" ? Math.max(1, Math.min(90, Math.trunc(Number(body.discountPct)) || 0)) : null,
        color: ["teal", "amber", "rose"].includes(body.color) ? body.color : "teal",
        active: body.active !== false,
        startsAt: body.startsAt ? new Date(String(body.startsAt)) : null,
        endsAt: body.endsAt ? new Date(String(body.endsAt)) : null,
      },
    })
    await audit(session.staffName ?? "Staff", session.staffRole, "PROMOTION_CREATED", "Promotion", promo.id, title)
    return NextResponse.json(toPromotionDTO(promo))
  } catch {
    return NextResponse.json({ error: "Could not create the promotion." }, { status: 500 })
  }
}
