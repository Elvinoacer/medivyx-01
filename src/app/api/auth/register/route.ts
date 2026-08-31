import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/hash"
import { createSession, toUserDTO } from "@/lib/session"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/
function normalizePhone(raw: string): string | null {
  const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
  if (!m) return null
  return `+254${m[1]}`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const email = body.email ? String(body.email).trim().toLowerCase() : null
    const phoneRaw = body.phone ? String(body.phone).trim() : null
    const password = String(body.password ?? "")

    if (name.length < 2) return NextResponse.json({ error: "Please enter your full name." }, { status: 400 })
    if (!email && !phoneRaw) return NextResponse.json({ error: "Provide a phone number or an email address." }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })

    const phone = phoneRaw ? normalizePhone(phoneRaw) : null
    if (phoneRaw && !phone) return NextResponse.json({ error: "Enter a valid Kenyan phone number (e.g. 0712 345 678)." }, { status: 400 })
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
    }

    if (email && (await db.user.findUnique({ where: { email } }))) {
      return NextResponse.json({ error: "An account with this email already exists. Try signing in instead." }, { status: 409 })
    }
    if (phone && (await db.user.findUnique({ where: { phone } }))) {
      return NextResponse.json({ error: "An account with this phone number already exists. Try signing in or use OTP." }, { status: 409 })
    }

    const user = await db.user.create({
      data: { name, email, phone, passwordHash: hashPassword(password) },
    })
    await db.notificationPref.create({ data: { userId: user.id } }).catch(() => {})
    if (phone) {
      // link guest orders placed with this phone before registration
      await db.order.updateMany({ where: { userId: null, guestPhone: phone }, data: { userId: user.id } })
    }
    await createSession({ userId: user.id })
    return NextResponse.json({ role: "CUSTOMER", user: toUserDTO(user) })
  } catch {
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 })
  }
}
