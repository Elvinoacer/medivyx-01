import { NextResponse } from "next/server"
import { destroySession, getSession } from "@/lib/session"
import { db } from "@/lib/db"
export async function POST(request: Request) {
  const session = await getSession()
  const body = await request.json().catch(() => ({}))
  if (typeof body.token === "string" && (session?.userId || session?.staffId)) {
    await db.pushToken.deleteMany({ where: { token: body.token, ...(session.userId ? { userId: session.userId } : { staffId: session.staffId }) } })
  }
  await destroySession()
  return NextResponse.json({ ok: true })
}
