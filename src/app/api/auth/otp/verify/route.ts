import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createSession, toUserDTO } from "@/lib/session"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const raw = String(body.phone ?? "").trim()
    const code = String(body.code ?? "").trim()
    const name = body.name ? String(body.name).trim() : null
    const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
    if (!m) return NextResponse.json({ error: "Enter a valid Kenyan phone number." }, { status: 400 })
    const phone = `+254${m[1]}`
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 })

    const otp = await db.otpCode.findFirst({
      where: { phone, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    })
    if (!otp) return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 401 })
    await db.otpCode.update({ where: { id: otp.id }, data: { used: true } })

    let user = await db.user.findUnique({ where: { phone } })
    if (!user) {
      user = await db.user.create({ data: { phone, name: name ?? "Customer" } })
      await db.notificationPref.create({ data: { userId: user.id } }).catch(() => {})
    }
    // link guest orders placed with this phone
    await db.order.updateMany({ where: { userId: null, guestPhone: phone }, data: { userId: user.id } })
    await createSession({ userId: user.id })
    return NextResponse.json({ role: "CUSTOMER", user: toUserDTO(user) })
  } catch {
    return NextResponse.json({ error: "Could not verify the code. Please try again." }, { status: 500 })
  }
}
