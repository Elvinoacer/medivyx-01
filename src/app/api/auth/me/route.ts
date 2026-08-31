import { NextResponse } from "next/server"
import { buildSessionPayload, getSession } from "@/lib/session"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: true, role: null })
  const payload = await buildSessionPayload(session)
  return NextResponse.json({ ok: true, ...payload })
}
