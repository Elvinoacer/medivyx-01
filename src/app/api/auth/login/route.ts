import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/hash"
import { buildSessionPayload, createSession, getSession, toUserDTO } from "@/lib/session"

/** Link guest orders (placed with this phone) to the account on sign-in. */
async function linkGuestOrders(phone: string, userId: string) {
  if (!phone) return
  await db.order.updateMany({ where: { userId: null, guestPhone: phone }, data: { userId } })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const identifier = String(body.identifier ?? "").trim().toLowerCase()
    const password = String(body.password ?? "")
    if (!identifier || !password) {
      return NextResponse.json({ error: "Enter your email/phone and password." }, { status: 400 })
    }
    const user = await db.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }, { phone: `+${identifier.replace(/^\+/, "")}` }] },
    })
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect email/phone or password." }, { status: 401 })
    }
    await createSession({ userId: user.id })
    if (user.phone) await linkGuestOrders(user.phone, user.id)
    const session = (await getSession())!
    await buildSessionPayload(session)
    return NextResponse.json({ role: "CUSTOMER", user: toUserDTO(user) })
  } catch {
    return NextResponse.json({ error: "Could not sign you in. Please try again." }, { status: 500 })
  }
}
