import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sendEmail } from "@/lib/email/resend"
import { sendPushNotification } from "@/lib/firebase/admin"
import { db } from "@/lib/db"

// POST /api/notifications/test — test push and email delivery
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Please sign in to test notifications." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const type = (body.type || "BOTH").toUpperCase()
  const title = body.title || "Sphere Pharmacy Test Notification"
  const message = body.message || "This is a test notification verifying Firebase push and Resend email integration."

  const results: Record<string, unknown> = {}

  // Test Email via Resend
  if (type === "EMAIL" || type === "BOTH") {
    let email = body.email
    if (!email && session.userId) {
      const u = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } })
      email = u?.email
    } else if (!email && session.staffId) {
      const s = await db.staffUser.findUnique({ where: { id: session.staffId }, select: { email: true } })
      email = s?.email
    }

    if (email) {
      const emailRes = await sendEmail({
        to: email,
        subject: `[Test] ${title}`,
        html: `
          <div style="font-family: sans-serif; padding: 24px; color: #1e293b;">
            <h2 style="color: #0f766e;">${title}</h2>
            <p>${message}</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">
              Sent from Sphere Pharmacy Notification System (Resend Integration).
            </p>
          </div>
        `,
        text: `${title}\n\n${message}`,
      })
      results.email = { recipient: email, ...emailRes }
    } else {
      results.email = { error: "No email address found for the current user." }
    }
  }

  // Test Push via Firebase FCM
  if (type === "PUSH" || type === "BOTH") {
    const where = session.userId ? { userId: session.userId } : { staffId: session.staffId! }
    const tokenRecords = await db.pushToken.findMany({ where, select: { token: true } })
    const tokens = tokenRecords.map((t) => t.token)

    if (tokens.length > 0) {
      const pushRes = await sendPushNotification({
        tokens,
        title,
        body: message,
        link: "/",
        data: { event: "TEST_NOTIFICATION" },
      })
      results.push = { tokensCount: tokens.length, ...pushRes }
    } else {
      results.push = {
        tokensCount: 0,
        message: "No push device tokens registered for this user yet. Enable push notifications in Account or Admin settings.",
      }
    }
  }

  return NextResponse.json({ ok: true, results })
}
