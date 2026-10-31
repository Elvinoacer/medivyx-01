import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sendEmail } from "@/lib/email/resend"
import { sendPushNotification } from "@/lib/firebase/admin"
import { db } from "@/lib/db"
import { audit } from "@/lib/notify"
import { enforceRateLimit, escapeHtml, rejectOversizedRequest } from "@/lib/security/request"
import { adminNotificationTemplate } from "@/lib/email/templates"

export async function POST(request: Request) {
  const session = await getSession()
  if (!session?.staffId || session.staffRole !== "ADMIN") return NextResponse.json({ error: "Administrator access required." }, { status: 403 })
  const tooLarge = rejectOversizedRequest(request, 8_192)
  if (tooLarge) return tooLarge
  const limited = await enforceRateLimit(request, "notification-test", 10, 60 * 60_000, session.staffId)
  if (limited) return limited
  const body = await request.json().catch(() => ({}))
  const type = ["EMAIL", "PUSH", "BOTH"].includes(String(body.type).toUpperCase()) ? String(body.type).toUpperCase() : "BOTH"
  const title = String(body.title || "Medivyx test notification").trim().slice(0, 100)
  const message = String(body.message || "Notification integration test.").trim().slice(0, 500)
  const admin = await db.staffUser.findUnique({ where: { id: session.staffId }, select: { email: true } })
  const results: Record<string, unknown> = {}

  if (type === "EMAIL" || type === "BOTH") {
    if (!admin?.email) {
      results.email = { success: false, error: "Your administrator account has no email address." }
    } else {
      const template = adminNotificationTemplate({
        title,
        message,
        details: {
          "Service": "Resend Email Integration",
          "Recipient": admin.email,
          "Sender": process.env.RESEND_FROM_EMAIL || "Medivyx <support@gtss.software>",
          "Timestamp": new Date().toLocaleString(),
        },
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://medivyx.co.ke"}/admin?section=settings`,
        actionLabel: "Open Admin Dashboard",
      })
      results.email = await sendEmail({
        to: admin.email,
        subject: `[Test] ${title}`,
        html: template.html,
        text: template.text,
      })
    }
  }
  if (type === "PUSH" || type === "BOTH") {
    const records = await db.pushToken.findMany({ where: { staffId: session.staffId }, select: { token: true } })
    results.push = records.length
      ? await sendPushNotification({ tokens: records.map((item) => item.token), title, body: message, link: "/admin?section=settings", data: { event: "TEST_NOTIFICATION" } })
      : { success: false, sentCount: 0, failedCount: 0, error: "No push-enabled device is registered for your administrator account. Please enable push notifications on this device first." }
  }
  await audit(session.staffName || "Admin", "ADMIN", "NOTIFICATION_TEST", "Notification", session.staffId, type)

  const email = results.email as { success?: boolean; error?: string; id?: string } | undefined
  const push = results.push as { success?: boolean; sentCount?: number; failedCount?: number; error?: string } | undefined
  const emailOk = !email || email.success === true
  const pushOk = !push || (push.success === true && (push.sentCount ?? 0) > 0)
  const ok = emailOk && pushOk

  let responseMessage = "Notification test completed successfully."
  if (type === "EMAIL" && emailOk) responseMessage = `Test email accepted for delivery to ${admin?.email}.`
  if (type === "PUSH" && pushOk) responseMessage = `Test push sent to ${push?.sentCount} registered device${push?.sentCount === 1 ? "" : "s"}.`
  if (!ok) {
    responseMessage = email?.error || push?.error ||
      (push && (push.failedCount ?? 0) > 0 ? `Firebase could not deliver to ${push.failedCount} registered device${push.failedCount === 1 ? "" : "s"}.` : "The notification provider rejected the test.")
  }

  return NextResponse.json({ ok, message: responseMessage, results }, { status: ok ? 200 : 422 })
}

export async function GET() {
  const session = await getSession()
  if (!session?.staffId || session.staffRole !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 })
  }

  const admin = await db.staffUser.findUnique({
    where: { id: session.staffId },
    select: { email: true, name: true },
  })
  const adminDeviceCount = await db.pushToken.count({
    where: { staffId: session.staffId },
  })
  const totalDeviceCount = await db.pushToken.count()

  const hasResend = Boolean(process.env.RESEND_API_KEY?.trim())
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "Medivyx <onboarding@resend.dev>"
  const hasFirebase = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  )
  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null

  return NextResponse.json({
    email: {
      configured: hasResend,
      fromEmail,
      recipient: admin?.email || null,
    },
    push: {
      configured: hasFirebase,
      projectId: firebaseProjectId,
      adminDeviceCount,
      totalDeviceCount,
    },
  })
}
