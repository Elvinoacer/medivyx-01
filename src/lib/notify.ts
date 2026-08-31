import { db } from "@/lib/db"
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/constants"

/** Whether the customer has opted into a notification channel (in-app is always on). */
async function channelAllowed(userId: string, channel: "IN_APP" | "SMS" | "WHATSAPP" | "EMAIL"): Promise<boolean> {
  if (channel === "IN_APP") return true
  const pref = await db.notificationPref.findUnique({ where: { userId } })
  if (!pref) return channel !== "EMAIL" // default opt-ins: SMS + WhatsApp, email off
  if (channel === "SMS") return pref.sms
  if (channel === "WHATSAPP") return pref.whatsapp
  return pref.email
}

/** Create an in-app notification for a customer (also models the SMS/WhatsApp channel visually). */
export async function notifyCustomer(
  userId: string | null,
  event: string,
  title: string,
  message: string,
  channel: "IN_APP" | "SMS" | "WHATSAPP" | "EMAIL" = "IN_APP"
): Promise<void> {
  if (!userId) return
  if (channel !== "IN_APP" && !(await channelAllowed(userId, channel))) return
  await db.notification.create({ data: { userId, channel, event, title, message } })
}

/** Append a status-history event to an order. */
export async function addStatusEvent(orderId: string, status: OrderStatus | string, actor: string, note?: string): Promise<void> {
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
