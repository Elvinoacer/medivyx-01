import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { ORDER_STATUS_LABELS, type OrderStatus, type Role } from "@/lib/constants"
import { serviceBookingTemplate } from "@/lib/email/templates"
import { escapeHtml } from "@/lib/security/request"

export type NotificationChannel = "IN_APP" | "SMS" | "WHATSAPP" | "EMAIL" | "PUSH"
export async function channelAllowed(userId: string, channel: NotificationChannel): Promise<boolean> {
  const pref = await db.notificationPref.findUnique({ where: { userId } })
  if (channel === "PUSH") return pref?.push ?? true
  if (channel === "EMAIL") return pref?.email ?? true
  if (channel === "SMS") return pref?.sms ?? false
  if (channel === "WHATSAPP") return pref?.whatsapp ?? false
  return true
}

export function notificationUrl(link?: string): string {
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke")
  const url = new URL(link || "/account", base)
  return url.origin === base.origin ? url.href : new URL("/account", base).href
}

type Email = { to?: string; subject: string; html: string; text?: string }
type Extra = { link?: string; metadata?: Record<string, unknown>; email?: Email; dedupeKey?: string; transaction?: Prisma.TransactionClient }

// Persist the inbox entry and all provider jobs together. No network I/O occurs here.
async function enqueue(tx: Prisma.TransactionClient, input: {
  userId?: string | null; staffId?: string; event: string; title: string; message: string; extra?: Extra
}) {
  const { userId, staffId, event, title, message, extra } = input
  const link = notificationUrl(extra?.link || (staffId ? "/admin" : "/account"))
  const key = extra?.dedupeKey || randomUUID()
  const owner = userId ? { userId } : staffId ? { staffId } : {}

  const recipientPromise = !extra?.email?.to && userId
    ? tx.user.findUnique({ where: { id: userId }, select: { email: true } })
    : !extra?.email?.to && staffId
    ? tx.staffUser.findUnique({ where: { id: staffId }, select: { email: true } })
    : Promise.resolve(null)

  const tokensPromise = userId || staffId
    ? tx.pushToken.findMany({ where: owner, select: { id: true, token: true } })
    : Promise.resolve([])

  const [recipient, tokens] = await Promise.all([recipientPromise, tokensPromise])
  const to = extra?.email?.to || recipient?.email

  const notifications: Prisma.NotificationCreateManyInput[] = []
  if (userId || staffId) {
    notifications.push({
      id: `notice:${key}`,
      ...owner,
      channel: "IN_APP",
      event,
      title,
      message,
      metadata: JSON.stringify({ ...extra?.metadata, link }),
    })
  }

  const jobs: Prisma.NotificationDeliveryCreateManyInput[] = []
  if (to) {
    jobs.push({
      ...owner,
      dedupeKey: `${key}:email`,
      channel: "EMAIL",
      payload: {
        to,
        subject: extra?.email?.subject || title,
        html: extra?.email?.html || `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(link)}">View your update</a></p>`,
        text: extra?.email?.text || `${message}\n\n${link}`,
      },
    })
  }

  for (const token of tokens) {
    jobs.push({
      ...owner,
      dedupeKey: `${key}:push:${token.id}`,
      channel: "PUSH",
      payload: {
        token: token.token,
        title: "Sphere Pharmacy",
        body: "You have a new update. Open Sphere to view it securely.",
        link,
        data: { event, notificationId: `notice:${key}` },
      },
    })
  }

  await Promise.all([
    notifications.length ? tx.notification.createMany({ data: notifications, skipDuplicates: true }) : Promise.resolve(),
    jobs.length ? tx.notificationDelivery.createMany({ data: jobs, skipDuplicates: true }) : Promise.resolve(),
  ])
}

export async function notifyCustomer(userId: string | null, event: string, title: string, message: string,
  _channel: NotificationChannel = "IN_APP", extra?: Extra): Promise<void> {
  if (!userId && !extra?.email?.to) return
  const run = (tx: Prisma.TransactionClient) => enqueue(tx, { userId, event, title, message, extra })
  if (extra?.transaction) await run(extra.transaction)
  else await db.$transaction(run, { timeout: 15000, maxWait: 5000 })
}

export interface NotifyStaffOptions {
  roles?: Role[]; staffId?: string; event: string; title: string; message: string; link?: string
  metadata?: Record<string, unknown>; emailSubject?: string; emailHtml?: string; emailText?: string
  details?: Record<string, string | number>; dedupeKey?: string; transaction?: Prisma.TransactionClient
}
export async function notifyStaff(opts: NotifyStaffOptions): Promise<void> {
  const run = async (tx: Prisma.TransactionClient) => {
    const staff = await tx.staffUser.findMany({
      where: {
        active: true,
        ...(opts.staffId ? { id: opts.staffId } : { role: { in: opts.roles || ["ADMIN"] } }),
      },
      select: { id: true, email: true },
    })
    if (staff.length === 0) return

    const staffIds = staff.map((s) => s.id)
    const tokens = await tx.pushToken.findMany({
      where: { staffId: { in: staffIds } },
      select: { id: true, token: true, staffId: true },
    })

    const tokensByStaff = new Map<string, Array<{ id: string; token: string }>>()
    for (const token of tokens) {
      if (!token.staffId) continue
      const list = tokensByStaff.get(token.staffId) || []
      list.push(token)
      tokensByStaff.set(token.staffId, list)
    }

    const link = notificationUrl(opts.link || "/admin")
    const notifications: Prisma.NotificationCreateManyInput[] = []
    const deliveryJobs: Prisma.NotificationDeliveryCreateManyInput[] = []

    for (const member of staff) {
      const key = opts.dedupeKey ? `${opts.dedupeKey}:${member.id}` : randomUUID()
      notifications.push({
        id: `notice:${key}`,
        staffId: member.id,
        channel: "IN_APP",
        event: opts.event,
        title: opts.title,
        message: opts.message,
        metadata: JSON.stringify({ ...opts.metadata, link }),
      })

      const to = member.email
      if (to && opts.emailHtml) {
        deliveryJobs.push({
          staffId: member.id,
          dedupeKey: `${key}:email`,
          channel: "EMAIL",
          payload: {
            to,
            subject: opts.emailSubject || opts.title,
            html: opts.emailHtml,
            text: opts.emailText || `${opts.message}\n\n${link}`,
          },
        })
      }

      const memberTokens = tokensByStaff.get(member.id) || []
      for (const token of memberTokens) {
        deliveryJobs.push({
          staffId: member.id,
          dedupeKey: `${key}:push:${token.id}`,
          channel: "PUSH",
          payload: {
            token: token.token,
            title: "Sphere Pharmacy",
            body: "You have a new update. Open Sphere to view it securely.",
            link,
            data: { event: opts.event, notificationId: `notice:${key}` },
          },
        })
      }
    }

    await Promise.all([
      notifications.length ? tx.notification.createMany({ data: notifications, skipDuplicates: true }) : Promise.resolve(),
      deliveryJobs.length ? tx.notificationDelivery.createMany({ data: deliveryJobs, skipDuplicates: true }) : Promise.resolve(),
    ])
  }
  if (opts.transaction) await run(opts.transaction)
  else await db.$transaction(run, { timeout: 15000, maxWait: 5000 })
}

/** Append a status-history event to an order. */
export async function addStatusEvent(
  orderId: string,
  status: OrderStatus | string,
  actor: string,
  note?: string
): Promise<void> {
  await db.orderStatusHistory.create({
    data: { orderId, status: status as string, actor, note: note ?? null },
  })
}

/** Record an action in the audit log. */
export async function audit(
  actor: string,
  actorRole: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: string | null
): Promise<void> {
  await db.auditLog.create({
    data: { actor, actorRole, action, entity, entityId: entityId ?? null, details: details ?? null },
  })
}

/** Standard status-change notification text for a customer. */
export function statusNotification(status: OrderStatus, reference: string): { title: string; message: string } {
  const label = ORDER_STATUS_LABELS[status] ?? status
  return {
    title: `Order ${reference}: ${label}`,
    message:
      status === "AWAITING_PAYMENT"
        ? `Your order ${reference} is awaiting payment. Complete payment from your order page to move it forward.`
        : status === "READY_FOR_PICKUP"
          ? `Good news! Order ${reference} is ready for pickup at the counter. Show your pickup code when collecting.`
          : status === "OUT_FOR_DELIVERY"
            ? `Order ${reference} is out for delivery — our rider is on the way.`
            : status === "PRESCRIPTION_VERIFIED"
              ? `Your prescription for order ${reference} has been verified by our pharmacist.`
              : status === "REJECTED"
                ? `Order ${reference} was rejected. Please check the review notes on your order page or contact us.`
                : status === "PAID"
                  ? `Payment received for order ${reference}. Thank you!`
                  : `Your order ${reference} is now: ${label}.`,
  }
}


export async function notifyServiceBooking(opts: {
  userId: string
  customerName?: string | null
  customerEmail?: string | null
  reference: string
  serviceName: string
  status: string
  message: string
  start: Date
  end: Date
  bookingId: string
  event?: string
  dedupeKey?: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
  const bookingUrl = `${appUrl}/services?tab=bookings`
  const template = serviceBookingTemplate({
    customerName: opts.customerName,
    reference: opts.reference,
    serviceName: opts.serviceName,
    status: opts.status,
    message: opts.message,
    start: opts.start,
    end: opts.end,
    bookingUrl,
  })
  await notifyCustomer(opts.userId, opts.event || "SERVICE_BOOKING", template.subject, opts.message, "IN_APP", {
    dedupeKey: opts.dedupeKey,
    link: bookingUrl,
    metadata: {
      bookingId: opts.bookingId,
      reference: opts.reference,
      serviceName: opts.serviceName,
      status: opts.status,
    },
    email: {
      to: opts.customerEmail || undefined,
      subject: template.subject,
      html: template.html,
      text: template.text,
    },
  })
}
