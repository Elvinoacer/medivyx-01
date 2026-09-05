import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function POST(request: Request) {
  const raw = await request.text()
  if (Buffer.byteLength(raw) > 65_536) return NextResponse.json({ error: "Payload too large" }, { status: 413 })
  const secret = process.env.RESEND_WEBHOOK_SECRET || ""
  const id = request.headers.get("svix-id") || ""
  const timestamp = request.headers.get("svix-timestamp") || ""
  if (!secret.startsWith("whsec_") || !id || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  const expected = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${timestamp}.${raw}`).digest()
  const valid = (request.headers.get("svix-signature") || "").split(" ").some(value => {
    const [version, signature] = value.split(",")
    if (version !== "v1" || !signature) return false
    const provided = Buffer.from(signature, "base64")
    return provided.length === expected.length && timingSafeEqual(provided, expected)
  })
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  let event: { type?: string; data?: { email_id?: string } }
  try { event = JSON.parse(raw) } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }
  const statuses: Record<string, string> = { "email.delivered": "DELIVERED", "email.bounced": "BOUNCED", "email.complained": "COMPLAINED", "email.failed": "FAILED" }
  const status = statuses[event.type || ""]
  if (!status || !event.data?.email_id) return NextResponse.json({ ok: true })
  // Persist before acknowledging: the provider event may arrive before the send
  // response has saved its provider ID. The dispatcher reconciles it afterwards.
  await db.emailDeliveryEvent.upsert({ where: { id }, update: {}, create: { id, providerId: event.data.email_id, status } })
  return NextResponse.json({ ok: true })
}
