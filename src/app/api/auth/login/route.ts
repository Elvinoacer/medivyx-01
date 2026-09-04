import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashPassword, verifyPassword } from "@/lib/hash"
import { buildSessionPayload, createSession, getSession, toUserDTO } from "@/lib/session"

import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 4_096)
    if (tooLarge) return tooLarge
    const body = await request.json()
    const identifier = String(body.identifier ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    if (!identifier || !password) {
      return NextResponse.json({ error: "Enter your email/phone and password." }, { status: 400 })
    }
    const limited = await enforceRateLimit(request, "customer-login", 10, 15 * 60 * 1000, identifier)
    if (limited) return limited
    const user = await db.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }, { phone: `+${identifier.replace(/^\+/, "")}` }] },
    })
    if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Incorrect email/phone or password." }, { status: 401 })
    }
    if (!user.passwordHash.startsWith("scrypt$")) await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
    await createSession({ userId: user.id })
    const session = (await getSession())!
    await buildSessionPayload(session)
    return NextResponse.json({ role: "CUSTOMER", user: toUserDTO(user) })
  } catch {
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 500 })
  }
}
