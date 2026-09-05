import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
export async function GET() {
  const { error } = await requireStaff(["ADMIN"])
  if (error) return error
  const [counts, oldest, failures] = await Promise.all([
    db.notificationDelivery.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    db.notificationDelivery.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    db.notificationDelivery.findMany({ where: { status: { in: ["FAILED", "BOUNCED", "COMPLAINED"] } }, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, channel: true, status: true, attempts: true, lastError: true, updatedAt: true } }),
  ])
  return NextResponse.json({ counts, oldestPendingAt: oldest?.createdAt || null, failures,
    configured: { email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL), emailWebhook: Boolean(process.env.RESEND_WEBHOOK_SECRET), push: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)), schedulerSecret: Boolean(process.env.CRON_SECRET) },
  }, { headers: { "Cache-Control": "private, no-store" } })
}
