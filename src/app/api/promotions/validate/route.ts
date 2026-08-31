import { NextResponse } from "next/server"
import { db } from "@/lib/db"

// POST /api/promotions/validate — check a promo code against the current subtotal
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const code = String(body.code ?? "").trim().toUpperCase()
    const subtotal = Number(body.subtotal)
    if (!code) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 })
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return NextResponse.json({ error: "Invalid subtotal." }, { status: 400 })
    }

    const now = new Date()
    const promo = await db.promotion.findFirst({
      where: {
        code,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
    })
    if (!promo || !promo.discountPct) {
      return NextResponse.json({ error: "That code isn't valid or has expired." }, { status: 404 })
    }
    const discountAmount = Math.round((subtotal * promo.discountPct) / 100)
    if (discountAmount <= 0) {
      return NextResponse.json({ error: "Your subtotal is too low for this code." }, { status: 400 })
    }
    return NextResponse.json({
      promotion: {
        id: promo.id,
        title: promo.title,
        description: promo.description,
        badge: promo.badge,
        code: promo.code,
        discountPct: promo.discountPct,
        color: promo.color,
        active: promo.active,
        startsAt: promo.startsAt?.toISOString() ?? null,
        endsAt: promo.endsAt?.toISOString() ?? null,
        createdAt: promo.createdAt.toISOString(),
      },
      discountAmount,
    })
  } catch {
    return NextResponse.json({ error: "Could not validate the code." }, { status: 500 })
  }
}
