import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSession, toUserDTO } from "@/lib/session"
import { hashOtp, safeEqualHex, tokenHash } from "@/lib/hash"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 4_096)
    if (tooLarge) return tooLarge
    const body = await request.json()
    const raw = String(body.phone ?? "").trim()
    const code = String(body.code ?? "").trim()
    const name = body.name ? String(body.name).trim() : null
    const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
    if (!m) return NextResponse.json({ error: "Enter a valid Kenyan phone number." }, { status: 400 })
    const phone = `+254${m[1]}`
    const limited = await enforceRateLimit(request, "otp-verify", 8, 10 * 60 * 1000, phone)
    if (limited) return limited
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 })

    const otp = await db.otpCode.findFirst({
      where: { phone, used: false, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    })
    if (!otp || !safeEqualHex(otp.codeHash, hashOtp(phone, code))) {
      if (otp) await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } })
      return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 401 })
    }
    const consumed = await db.otpCode.updateMany({ where: { id: otp.id, used: false, attempts: { lt: 5 } }, data: { used: true } })
    if (consumed.count !== 1) return NextResponse.json({ error: "This code has already been used." }, { status: 409 })

    let user = await db.user.findUnique({ where: { phone } })
    if (!user) {
      user = await db.user.create({ data: { phone, name: name ?? "Customer", phoneVerifiedAt: new Date() } })
      await db.notificationPref.create({ data: { userId: user.id } }).catch(() => {})
    }
    if (!user.phoneVerifiedAt) user = await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } })
    const claimToken = typeof body.claimToken === "string" ? body.claimToken : ""
    if (claimToken) {
      await db.order.updateMany({ where: { userId: null, guestPhone: phone, guestAccessTokenHash: tokenHash(claimToken), guestAccessExpiresAt: { gt: new Date() } }, data: { userId: user.id, guestAccessTokenHash: null, guestAccessExpiresAt: null } })
    }
    await createSession({ userId: user.id })
    return NextResponse.json({ role: "CUSTOMER", user: toUserDTO(user) })
  } catch {
    return NextResponse.json({ error: "Could not verify the code. Please try again." }, { status: 500 })
  }
}
