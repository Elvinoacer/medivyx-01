import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireCustomer } from "@/lib/session"

const DEFAULTS = { sms: true, whatsapp: true, email: false }

// GET /api/notifications/prefs — channel preferences for the signed-in customer
export async function GET() {
  const { session, error } = await requireCustomer()
  if (error) return error
  const pref = await db.notificationPref.findUnique({ where: { userId: session!.userId! } })
  return NextResponse.json(pref ? { sms: pref.sms, whatsapp: pref.whatsapp, email: pref.email } : DEFAULTS)
}

// PUT /api/notifications/prefs — update channel preferences (upsert)
export async function PUT(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const body = await request.json().catch(() => ({}))

  const sms = typeof body.sms === "boolean" ? body.sms : undefined
  const whatsapp = typeof body.whatsapp === "boolean" ? body.whatsapp : undefined
  const email = typeof body.email === "boolean" ? body.email : undefined
  if (sms === undefined && whatsapp === undefined && email === undefined) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  const existing = await db.notificationPref.findUnique({ where: { userId: session!.userId! } })
  const data = {
    sms: sms ?? existing?.sms ?? DEFAULTS.sms,
    whatsapp: whatsapp ?? existing?.whatsapp ?? DEFAULTS.whatsapp,
    email: email ?? existing?.email ?? DEFAULTS.email,
  }
  const pref = await db.notificationPref.upsert({
    where: { userId: session!.userId! },
    update: data,
    create: { userId: session!.userId!, ...data },
  })
  return NextResponse.json({ sms: pref.sms, whatsapp: pref.whatsapp, email: pref.email })
}
