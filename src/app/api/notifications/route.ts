import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toNotificationDTO } from "@/lib/dto"
import { requireCustomer } from "@/lib/session"

export async function GET() {
  const { session, error } = await requireCustomer()
  if (error) return error
  const rows = await db.notification.findMany({
    where: { userId: session.userId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  return NextResponse.json(rows.map(toNotificationDTO))
}

export async function PATCH(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const body = await request.json().catch(() => ({}))
  if (body.id) {
    await db.notification.updateMany({ where: { id: String(body.id), userId: session.userId! }, data: { read: true } })
  } else {
    await db.notification.updateMany({ where: { userId: session.userId! }, data: { read: true } })
  }
  return NextResponse.json({ ok: true })
}
