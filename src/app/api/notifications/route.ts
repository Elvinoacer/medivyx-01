import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toNotificationDTO } from "@/lib/dto"
import { getSession } from "@/lib/session"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Please sign in to view notifications." }, { status: 401 })
  }

  const where = session.userId
    ? { userId: session.userId }
    : session.staffId
      ? { staffId: session.staffId }
      : null

  if (!where) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const rows = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json(rows.map(toNotificationDTO), { headers: { "Cache-Control": "private, no-store" } })
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 })
  }

  const whereOwner = session.userId
    ? { userId: session.userId }
    : session.staffId
      ? { staffId: session.staffId }
      : null

  if (!whereOwner) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  if (body.id) {
    await db.notification.updateMany({
      where: { id: String(body.id), ...whereOwner },
      data: { read: true },
    })
  } else {
    await db.notification.updateMany({
      where: whereOwner,
      data: { read: true },
    })
  }
  return NextResponse.json({ ok: true })
}
