import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, validatePassword, verifyPassword } from "@/lib/hash"
import { requireCustomer, toUserDTO } from "@/lib/session"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

export async function PATCH(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  try {
    const body = await request.json()
    const user = (await db.user.findUnique({ where: { id: session.userId! } }))!
    const data: Record<string, string | null> = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (name.length < 2) return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 })
      data.name = name
    }
    if (body.avatar !== undefined) {
      data.avatar = body.avatar ? String(body.avatar) : null
    }
    if (body.email !== undefined) {
      const email = body.email ? String(body.email).trim().toLowerCase() : null
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 })
      }
      if (email) {
        const clash = await db.user.findUnique({ where: { email } })
        if (clash && clash.id !== user.id) return NextResponse.json({ error: "This email is already in use." }, { status: 409 })
      }
      data.email = email
    }
    if (body.phone !== undefined) {
      const raw = body.phone ? String(body.phone).trim() : null
      let phone: string | null = null
      if (raw) {
        const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
        if (!m) return NextResponse.json({ error: "Enter a valid Kenyan phone number." }, { status: 400 })
        phone = `+254${m[1]}`
        const clash = await db.user.findUnique({ where: { phone } })
        if (clash && clash.id !== user.id) return NextResponse.json({ error: "This phone number is already in use." }, { status: 409 })
      }
      data.phone = phone
    }
    if (body.password) {
      const current = String(body.currentPassword ?? "")
      if (!user.passwordHash || !(await verifyPassword(current, user.passwordHash))) {
        return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 })
      }
      const passwordError = validatePassword(String(body.password))
      if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })
      data.passwordHash = await hashPassword(String(body.password))
    }

    const updated = await db.user.update({ where: { id: user.id }, data })
    return NextResponse.json({ role: "CUSTOMER", user: toUserDTO(updated) })
  } catch {
    return NextResponse.json({ error: "Could not update your profile. Please try again." }, { status: 500 })
  }
}
