import { db } from "@/lib/db"
import { ORDER_STATUS_LABELS, type OrderStatus, type Role } from "@/lib/constants"
import { sendPushNotification } from "@/lib/firebase/admin"
import { sendEmail } from "@/lib/email/resend"
import { adminNotificationTemplate, serviceBookingTemplate } from "@/lib/email/templates"

export type NotificationChannel = "IN_APP" | "SMS" | "WHATSAPP" | "EMAIL" | "PUSH"

/** Whether the customer has opted into a notification channel (in-app is always on). */
export async function channelAllowed(
  userId: string,
  channel: NotificationChannel
): Promise<boolean> {
  if (channel === "IN_APP") return true
  const pref = await db.notificationPref.findUnique({ where: { userId } })
  if (!pref) return true // default opt-ins: all enabled
  if (channel === "SMS") return pref.sms
  if (channel === "WHATSAPP") return pref.whatsapp
  if (channel === "EMAIL") return pref.email
  if (channel === "PUSH") return pref.push
  return true
}

export interface CustomerNotificationPayload {
  userId: string | null
  event: string
  title: string
  message: string
  channel?: NotificationChannel
  link?: string
  metadata?: Record<string, unknown>
  email?: {
    to?: string
    subject: string
    html: string
    text?: string
  }
}

/**
 * Send a multi-channel notification to a customer:
 * - Always records an in-app notification in the database (if userId present)
 * - Sends Firebase push notification to all registered device tokens for this user
 * - Sends an email via Resend if email payload or recipient is provided
 */
export async function notifyCustomer(
  userId: string | null,
  event: string,
  title: string,
  message: string,
  channel: NotificationChannel = "IN_APP",
  extra?: {
    link?: string
    metadata?: Record<string, unknown>
    email?: {
      to?: string
      subject: string
      html: string
      text?: string
    }
  }
): Promise<void> {
  if (!userId) {
    // If no userId but email is provided (e.g., guest checkout), send the email directly
    if (extra?.email?.to) {
      await sendEmail({
        to: extra.email.to,
        subject: extra.email.subject,
        html: extra.email.html,
        text: extra.email.text,
      }).catch((e) => console.warn("[Guest Email Error]", e))
    }
    return
  }

  // 1. In-app DB notification
  try {
    await db.notification.create({
      data: {
        userId,
        channel,
        event,
        title,
        message,
        metadata: extra?.metadata ? JSON.stringify(extra.metadata) : null,
      },
    })
  } catch (err) {
    console.error("[notifyCustomer DB error]", err)
  }

  // 2. Firebase Push Notification (if customer has push enabled)
  try {
    const isPushEnabled = await channelAllowed(userId, "PUSH")
    if (isPushEnabled) {
      const pushRecords = await db.pushToken.findMany({
        where: { userId },
        select: { token: true },
      })
      const tokens = pushRecords.map((r) => r.token).filter(Boolean)
      if (tokens.length > 0) {
        await sendPushNotification({
          tokens,
          title,
          body: message,
          link: extra?.link,
          data: {
            event,
            ...(extra?.metadata
              ? Object.fromEntries(
                  Object.entries(extra.metadata).map(([k, v]) => [k, String(v)])
                )
              : {}),
          },
        })
      }
    }
  } catch (err) {
    console.error("[notifyCustomer Push error]", err)
  }

  // 3. Resend Email Notification (if customer has email enabled)
  try {
    const isEmailEnabled = await channelAllowed(userId, "EMAIL")
    if (isEmailEnabled) {
      // Determine recipient email: from extra.email.to or lookup user record
      let recipientEmail = extra?.email?.to
      if (!recipientEmail) {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { email: true },
        })
        recipientEmail = user?.email ?? undefined
      }

      if (recipientEmail && extra?.email) {
        await sendEmail({
          to: recipientEmail,
          subject: extra.email.subject,
          html: extra.email.html,
          text: extra.email.text,
        })
      }
    }
  } catch (err) {
    console.error("[notifyCustomer Email error]", err)
  }
}

export interface NotifyStaffOptions {
  roles?: Role[] // e.g. ["ADMIN", "PHARMACIST"]
  staffId?: string // target specific rider or staff member
  event: string
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
  emailSubject?: string
  emailHtml?: string
  emailText?: string
  details?: Record<string, string | number>
}

/**
 * Send real-time multi-channel notifications to Admins, Pharmacists, Staff, or Riders:
 * - Creates in-app notifications for each targeted staff member
 * - Sends Firebase push notifications to all active staff device tokens
 * - Sends alert emails via Resend to staff member email addresses
 */
export async function notifyStaff(opts: NotifyStaffOptions): Promise<void> {
  const { roles, staffId, event, title, message, link, metadata, emailSubject, emailHtml, emailText, details } = opts

  try {
    // 1. Find target staff members
    const where: Record<string, unknown> = { active: true }
    if (staffId) {
      where.id = staffId
    } else if (roles && roles.length > 0) {
      where.role = { in: roles }
    }

    const staffMembers = await db.staffUser.findMany({
      where,
      select: { id: true, email: true, name: true, role: true },
    })

    if (staffMembers.length === 0) return

    // 2. Create in-app notifications in DB for all target staff
    await db.notification.createMany({
      data: staffMembers.map((staff) => ({
        staffId: staff.id,
        channel: "IN_APP",
        event,
        title,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })),
    })

    // 3. Collect push tokens for all target staff
    const staffIds = staffMembers.map((s) => s.id)
    const tokenRecords = await db.pushToken.findMany({
      where: { staffId: { in: staffIds } },
      select: { token: true },
    })
    const tokens = tokenRecords.map((t) => t.token).filter(Boolean)

    // 4. Send Firebase Push Notification
    if (tokens.length > 0) {
      await sendPushNotification({
        tokens,
        title: `[Sphere Pharmacy] ${title}`,
        body: message,
        link: link || "/admin",
        data: {
          event,
          ...(metadata
            ? Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k, String(v)]))
            : {}),
        },
      })
    }

    // 5. Send Resend Email to staff
    const staffEmails = staffMembers
      .map((s) => s.email?.trim())
      .filter((e): e is string => Boolean(e && e.includes("@")))

    if (staffEmails.length > 0) {
      const template = adminNotificationTemplate({
        title,
        message,
        details,
        actionUrl: link || process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke",
        actionLabel: "Open Staff Dashboard",
      })

      await sendEmail({
        to: staffEmails,
        subject: emailSubject || template.subject,
        html: emailHtml || template.html,
        text: emailText || template.text,
      })
    }
  } catch (error) {
    console.error("[notifyStaff error]", error)
  }
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
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
  const bookingUrl = `${appUrl}/#services`
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
    link: bookingUrl,
    metadata: {
      bookingId: opts.bookingId,
      reference: opts.reference,
      serviceName: opts.serviceName,
      status: opts.status,
    },
    email: opts.customerEmail ? {
      to: opts.customerEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    } : undefined,
  })
}
