import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/hash"
import { createSession, toStaffDTO } from "@/lib/session"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    if (!email || !password) {
      return NextResponse.json({ error: "Enter your staff email and password." }, { status: 400 })
    }
    const staff = await db.staffUser.findUnique({ where: { email } })
    if (!staff || !verifyPassword(password, staff.passwordHash)) {
      return NextResponse.json({ error: "Incorrect staff email or password." }, { status: 401 })
    }
    if (!staff.active) {
      return NextResponse.json({ error: "This staff account is deactivated. Contact your admin." }, { status: 403 })
    }
    await createSession({ staffId: staff.id })
    return NextResponse.json({ role: staff.role, staff: toStaffDTO(staff) })
  } catch {
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 500 })
  }
}
