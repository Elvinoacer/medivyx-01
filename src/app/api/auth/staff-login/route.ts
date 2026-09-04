import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/hash"
import { createSession, toStaffDTO } from "@/lib/session"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 4_096)
    if (tooLarge) return tooLarge
    const body = await request.json()
    const email = String(body.email ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    if (!email || !password) {
      return NextResponse.json({ error: "Enter your staff email and password." }, { status: 400 })
    }
    const limited = await enforceRateLimit(request, "staff-login", 5, 15 * 60 * 1000, email)
    if (limited) return limited
    const staff = await db.staffUser.findUnique({ where: { email } })
    if (!staff || !(await verifyPassword(password, staff.passwordHash))) {
      return NextResponse.json({ error: "Incorrect staff email or password." }, { status: 401 })
    }
    if (!staff.active) {
      return NextResponse.json({ error: "This staff account is deactivated. Contact your admin." }, { status: 403 })
    }
    if (!staff.passwordHash.startsWith("scrypt$")) await db.staffUser.update({ where: { id: staff.id }, data: { passwordHash: await hashPassword(password) } })
    await createSession({ staffId: staff.id })
    return NextResponse.json({ role: staff.role, staff: toStaffDTO(staff) })
  } catch {
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 500 })
  }
}
