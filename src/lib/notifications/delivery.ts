import { randomUUID, timingSafeEqual } from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { sendEmail, type SendEmailOptions } from "@/lib/email/resend"
import { sendPushNotification } from "@/lib/firebase/admin"

export function authorizedJob(request: Request): boolean {
  const secret = process.env.CRON_SECRET || ""
  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(request.headers.get("authorization") || "")
  return secret.length >= 32 && expected.length === provided.length && timingSafeEqual(expected, provided)
}

// One job per recipient/device; a failed token never resends successful devices.
export async function dispatchNotifications(limit = 20) {
  const now = new Date()
  const due = { OR: [
    { status: "PENDING", availableAt: { lte: now } },
    { status: "PROCESSING", lockedUntil: { lte: now } },
  ] }
  const jobs = await db.notificationDelivery.findMany({ where: due, orderBy: { availableAt: "asc" }, take: limit })
  let accepted = 0, failed = 0, skipped = 0
  for (const job of jobs) {
    const lockToken = randomUUID()
    const claim = await db.notificationDelivery.updateMany({ where: { id: job.id, ...due }, data: {
      status: "PROCESSING", lockToken, lockedUntil: new Date(Date.now() + 120_000), attempts: { increment: 1 },
    } })
    if (!claim.count) continue
    const finish = (data: Prisma.NotificationDeliveryUpdateManyMutationInput) => db.notificationDelivery.updateMany({
      where: { id: job.id, lockToken }, data: { ...data, lockToken: null, lockedUntil: null },
    })
    try {
      const user = job.userId ? await db.user.findUnique({ where: { id: job.userId }, select: { id: true } }) : null
      const staff = job.staffId ? await db.staffUser.findUnique({ where: { id: job.staffId }, select: { active: true } }) : null
      const pref = job.userId ? await db.notificationPref.findUnique({ where: { userId: job.userId } }) : null
      const optedOut = (job.channel === "EMAIL" && pref?.email === false) || (job.channel === "PUSH" && pref?.push === false)
      if ((job.userId && !user) || (job.staffId && !staff?.active) || optedOut) {
        await finish({ status: "SKIPPED", lastError: "Recipient unavailable or channel disabled" }); skipped++; continue
      }
      // Resend only deduplicates for 24h. Do not automatically retry ambiguous old submissions.
      if (job.attempts > 0 && Date.now() - job.createdAt.getTime() > 23 * 3600_000) {
        await finish({ status: "FAILED", lastError: "Retry window expired; review provider delivery history before retrying" }); failed++; continue
      }
      let providerId: string | undefined
      if (job.channel === "EMAIL") {
        const payload = job.payload as unknown as SendEmailOptions
        const address = String(payload.to).trim().toLowerCase()
        if (await db.emailSuppression.findUnique({ where: { email: address } })) {
          await finish({ status: "SKIPPED", lastError: "Recipient suppressed after bounce or complaint" }); skipped++; continue
        }
        const result = await sendEmail({ ...payload, idempotencyKey: job.id })
        if (!result.success) throw new Error(result.error || "Email provider rejected delivery")
        providerId = result.id
      } else if (job.channel === "PUSH") {
        const payload = job.payload as { token: string; title: string; body: string; link: string; data: Record<string, string> }
        const owner = job.userId ? { userId: job.userId } : { staffId: job.staffId }
        const token = await db.pushToken.findFirst({ where: { token: payload.token, ...owner } })
        if (!token) { await finish({ status: "SKIPPED", lastError: "Device registration removed or owner changed" }); skipped++; continue }
        const result = await sendPushNotification({ tokens: [payload.token], title: payload.title, body: payload.body, link: payload.link, data: payload.data })
        if (result.invalidTokens?.includes(payload.token)) { await finish({ status: "SKIPPED", lastError: "Device unregistered" }); skipped++; continue }
        if (!result.success) throw new Error(result.error || "Push provider rejected delivery")
      } else throw new Error("Unsupported delivery channel")
      await finish({ status: "SENT", providerId, sentAt: new Date(), lastError: null }); accepted++
    } catch {
      const attempts = job.attempts + 1
      await finish({ status: attempts >= 8 ? "FAILED" : "PENDING", lastError: "Provider delivery failed; inspect configuration and provider logs", availableAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** (attempts - 1)) * 1000) })
      failed++
    }
  }
  await reconcileEmailEvents()
  return { accepted, failed, skipped }
}

async function reconcileEmailEvents() {
  const events = await db.emailDeliveryEvent.findMany({ where: { processed: false }, orderBy: { createdAt: "asc" }, take: 100 })
  for (const event of events) {
    await db.$transaction(async tx => {
      const jobs = await tx.notificationDelivery.findMany({ where: { providerId: event.providerId, channel: "EMAIL" } })
      if (!jobs.length && Date.now() - event.createdAt.getTime() < 24 * 3600_000) return
      for (const job of jobs) {
        await tx.notificationDelivery.updateMany({ where: { id: job.id, status: { notIn: ["BOUNCED", "COMPLAINED"] } }, data: { status: event.status, lastError: event.status === "DELIVERED" ? null : event.status } })
        if (["BOUNCED", "COMPLAINED"].includes(event.status)) {
          const email = (job.payload as { to?: string }).to?.trim().toLowerCase()
          if (email) await tx.emailSuppression.upsert({ where: { email }, create: { email, reason: event.status }, update: { reason: event.status } })
        }
      }
      await tx.emailDeliveryEvent.update({ where: { id: event.id }, data: { processed: true } })
    })
  }
}
