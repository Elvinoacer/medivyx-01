import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

// POST /api/notifications/push-token — register or update a device's push token
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body.token === "string" ? body.token.trim() : ""
    const platform = typeof body.platform === "string" ? body.platform.slice(0, 200) : null

    if (!token) {
      return NextResponse.json({ error: "Push token is required." }, { status: 400 })
    }

    const session = await getSession()
    const userId = session?.userId ?? null
    const staffId = session?.staffId ?? null
    const role = session ? (session.role || "CUSTOMER") : "GUEST"

    // Upsert the token to link it to the user/staff member
    const record = await db.pushToken.upsert({
      where: { token },
      update: {
        userId,
        staffId,
        role: String(role),
        platform,
      },
      create: {
        token,
        userId,
        staffId,
        role: String(role),
        platform,
      },
    })

    return NextResponse.json({ ok: true, id: record.id })
  } catch (error) {
    console.error("[Push Token POST Error]", error)
    return NextResponse.json({ error: "Failed to save push token." }, { status: 500 })
  }
}

// DELETE /api/notifications/push-token — remove a push token
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const token = typeof body.token === "string" ? body.token.trim() : ""

    if (token) {
      await db.pushToken.deleteMany({ where: { token } })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Push Token DELETE Error]", error)
    return NextResponse.json({ error: "Failed to remove push token." }, { status: 500 })
  }
}
