import { NextRequest } from "next/server"
import { getSession } from "@/lib/session"
import { promotionIdentity, withPromoDeviceCookie } from "@/lib/promotions"
import { enforceRateLimit } from "@/lib/security/request"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { rejectOversizedRequest } from "@/lib/security/request"

// POST /api/promotions/validate — check a promo code against the current subtotal
export async function POST(request: NextRequest) {
  const oversized = rejectOversizedRequest(request, 8_192)
  if (oversized) return oversized
  try {
    const limited = await enforceRateLimit(request, "promotion-validate", 40, 60 * 1000)
    if (limited) return limited
    const body = await request.json()
    const code = String(body.code ?? "").trim().toUpperCase()
    const subtotal = Number(body.subtotal)
    if (!code) return NextResponse.json({ error: "Enter a promo code." }, { status: 400 })
    if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 10_000_000) {
      return NextResponse.json({ error: "Invalid subtotal." }, { status: 400 })
    }

    const now = new Date()
    const promo = await db.promotion.findUnique({
      where: {
        code,
      },
    })
    if (!promo || !promo.active || !promo.discountPct || promo.startsAt && promo.startsAt > now || promo.endsAt && promo.endsAt < now) {
      return NextResponse.json({ error: "That code isn't valid or has expired." }, { status: 404 })
    }
    if (promo.minimumSpend && subtotal < Number(promo.minimumSpend)) return NextResponse.json({ error: "Your subtotal is too low for this code." }, { status: 400 })
    if (promo.maxUses != null && await db.promotionRedemption.count({ where: { promotionId: promo.id } }) >= promo.maxUses) return NextResponse.json({ error: "This promotion has reached its usage limit." }, { status: 409 })
    const session = await getSession()
    const userId = session?.role === "CUSTOMER" ? session.userId : null
    const {ipHash,browserHash} = promotionIdentity(request)
    if (promo.perUserLimit != null && !userId) return NextResponse.json({error:"Sign in to use this code. The promotion has a per-customer redemption limit."},{status:401})
    if (promo.perUserLimit != null && userId && await db.promotionRedemption.count({where:{promotionId:promo.id,userId}}) >= promo.perUserLimit) return NextResponse.json({error:"You've used this code the maximum number of times."},{status:409})
    if (promo.perIpLimit != null && ipHash && await db.promotionRedemption.count({where:{promotionId:promo.id,ipHash}}) >= promo.perIpLimit) return NextResponse.json({error:"This promotion has reached the usage limit for your network."},{status:409})
    if (promo.perBrowserLimit != null && browserHash && await db.promotionRedemption.count({where:{promotionId:promo.id,browserHash}}) >= promo.perBrowserLimit) return NextResponse.json({error:"This browser has reached its redemption limit for this promotion."},{status:409})
    const discountAmount = Math.round((subtotal * promo.discountPct) / 100 * 100) / 100
    if (discountAmount <= 0) {
      return NextResponse.json({ error: "Your subtotal is too low for this code." }, { status: 400 })
    }
    const result = NextResponse.json({
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
    }, {headers:{"Cache-Control":"no-store"}})
    return withPromoDeviceCookie(result,request)
  } catch {
    return NextResponse.json({ error: "Could not validate the code." }, { status: 500 })
  }
}
