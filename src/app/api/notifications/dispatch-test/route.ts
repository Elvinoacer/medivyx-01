import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sendEmail } from "@/lib/email/resend"
import { sendPushNotification } from "@/lib/firebase/admin"
import { db } from "@/lib/db"
import { audit } from "@/lib/notify"
import { enforceRateLimit, escapeHtml, rejectOversizedRequest } from "@/lib/security/request"

export async function POST(request: Request) {
  if (process.env.ENABLE_NOTIFICATION_TESTS !== "true") return NextResponse.json({ error: "Not found." }, { status: 404 })
  const session = await getSession()
  if (!session?.staffId || session.staffRole !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 })
  const tooLarge = rejectOversizedRequest(request, 8_192)
  if (tooLarge) return tooLarge
  const limited = await enforceRateLimit(request, "notification-test", 3, 60 * 60_000, session.staffId)
  if (limited) return limited
  const body = await request.json().catch(() => ({}))
  const type = ["EMAIL", "PUSH", "BOTH"].includes(String(body.type).toUpperCase()) ? String(body.type).toUpperCase() : "BOTH"
  const title = String(body.title || "Sphere Pharmacy test notification").trim().slice(0, 100)
  const message = String(body.message || "Notification integration test.").trim().slice(0, 500)
  const admin = await db.staffUser.findUnique({ where: { id: session.staffId }, select: { email: true } })
  const results: Record<string, unknown> = {}

  if ((type === "EMAIL" || type === "BOTH") && admin?.email) {
    results.email = await sendEmail({ to: admin.email, subject: `[Test] ${title}`, html: `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>`, text: `${title}\n\n${message}` })
  }
  if (type === "PUSH" || type === "BOTH") {
    const records = await db.pushToken.findMany({ where: { staffId: session.staffId }, select: { token: true } })
    results.push = records.length ? await sendPushNotification({ tokens: records.map((item) => item.token), title, body: message, link: "/admin", data: { event: "TEST_NOTIFICATION" } }) : { tokensCount: 0 }
  }
  await audit(session.staffName || "Admin", "ADMIN", "NOTIFICATION_TEST", "Notification", session.staffId, type)
  return NextResponse.json({ ok: true, results })
}
