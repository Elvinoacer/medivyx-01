import { randomUUID } from "node:crypto"
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
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return NextResponse.json({
      error: "Codes must be 3–32 letters, numbers, underscores or hyphens. Check the code and try again.",
    }, { status: 400 })
    if (!Number.isFinite(subtotal) || subtotal < 0 || subtotal > 10_000_000) {
      return NextResponse.json({ error: "Invalid subtotal." }, { status: 400 })
    }

    if (subtotal === 0) return NextResponse.json({ error: "Add products to your bag before applying a code." }, { status: 400 })

    const now = new Date()
    const promo = await db.promotion.findUnique({
      where: {
        code,
      },
    })
    if (!promo) return NextResponse.json({ error: "Code not found. Double-check the spelling and try again." }, { status: 404 })
    if (!promo.active) return NextResponse.json({ error: "This offer is currently paused. Try another available code." }, { status: 409 })
    if (!promo.discountPct) return NextResponse.json({ error: "This promotion does not provide a checkout-code discount." }, { status: 409 })
    if (promo.startsAt && promo.startsAt > now) return NextResponse.json({ error: "This offer has not started yet. Check back when it goes live." }, { status: 409 })
    if (promo.endsAt && promo.endsAt < now) return NextResponse.json({ error: "This offer has expired. See the Offers page for current codes." }, { status: 410 })
    if (promo.minimumSpend && subtotal < Number(promo.minimumSpend)) {
      const shortage = (Number(promo.minimumSpend) - subtotal).toLocaleString("en-KE", { maximumFractionDigits: 2 })
      return NextResponse.json({ error: `Add KSh ${shortage} more to your bag to use this code (minimum KSh ${Number(promo.minimumSpend).toLocaleString("en-KE")}).` }, { status: 400 })
    }
    if (promo.maxUses != null && await db.promotionRedemption.count({ where: { promotionId: promo.id } }) >= promo.maxUses) return NextResponse.json({ error: "This promotion has reached its usage limit." }, { status: 409 })
    const session = await getSession()
    const userId = session?.role === "CUSTOMER" ? session.userId : null
    const {ipHash,browserHash} = promotionIdentity(request)
    if (promo.perUserLimit != null && !userId) return NextResponse.json({error:"Sign in to redeem this code. It has a per-customer usage limit."},{status:401})
    if (promo.perUserLimit != null && userId && await db.promotionRedemption.count({where:{promotionId:promo.id,userId}}) >= promo.perUserLimit) return NextResponse.json({error:"You've used this code the maximum number of times."},{status:409})
    if (promo.perIpLimit != null && !ipHash) return NextResponse.json({
      error: "This offer needs secure network verification, which is unavailable right now. Please contact the pharmacy team.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } })
    if (promo.perIpLimit != null && ipHash && await db.promotionRedemption.count({where:{promotionId:promo.id,ipHash}}) >= promo.perIpLimit) return NextResponse.json({error:"This promotion has reached the usage limit for your network."},{status:409})
    if (promo.perBrowserLimit != null && browserHash && await db.promotionRedemption.count({where:{promotionId:promo.id,browserHash}}) >= promo.perBrowserLimit) return NextResponse.json({error:"This browser has reached its redemption limit for this promotion."},{status:409})
    const discountAmount = Math.round((subtotal * promo.discountPct) / 100 * 100) / 100
    if (discountAmount <= 0) {
      return NextResponse.json({ error: "This code requires a qualifying basket subtotal greater than zero." }, { status: 400 })
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
  } catch (error) {
    // Never mislabel infrastructure exceptions as invalid customer codes.
    // Correlate the customer-facing reference to the full server-side exception.
    const errorId = randomUUID()
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code : null
    const missingSchema = code === "P2021" || code === "P2022"
    const dbUnavailable = ["P1001", "P1002", "P2024"].includes(code ?? "")
    console.error("[promotion-validation] backend failure", { errorId, prismaCode: code, error })
    const message = missingSchema
      ? "Promotion verification is awaiting a required database update. Please contact the pharmacy team."
      : dbUnavailable
        ? "Promotion verification is temporarily unavailable because the database could not be reached. Please try again shortly."
        : "Promotion verification is temporarily unavailable due to a server error. Please try again or contact the pharmacy team."
    return NextResponse.json(
      { error: `${message} Reference: ${errorId.slice(0, 8)}.`, errorId },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }
}
