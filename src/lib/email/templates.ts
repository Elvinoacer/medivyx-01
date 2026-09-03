// Email templates for Sphere Pharmacy
// Compatible with all major email clients (Gmail, Apple Mail, Outlook, mobile)

const BRAND = {
  name: "Sphere Pharmacy",
  location: "Lumumba Drive, Roysambu, Nairobi",
  phone: "+254 792 411 911",
  whatsapp: "+254 792 411 911",
  color: "#0f766e",
  accent: "#0d9488",
  bg: "#f8fafc",
  cardBg: "#ffffff",
  text: "#1e293b",
  muted: "#64748b",
}

function baseLayout(title: string, bodyContent: string, actionButton?: { text: string; url: string }): string {
  const buttonHtml = actionButton
    ? `
      <div style="margin: 32px 0 24px; text-align: center;">
        <a href="${actionButton.url}" style="background-color: ${BRAND.color}; color: #ffffff; padding: 12px 28px; font-weight: 600; font-size: 15px; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(15,118,110,0.2);">
          ${actionButton.text}
        </a>
      </div>
    `
    : ""

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${BRAND.text}; line-height: 1.6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.bg}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: ${BRAND.cardBg}; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.color} 0%, #115e59 100%); padding: 24px 32px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">
                      ${BRAND.name}
                    </h1>
                    <p style="margin: 4px 0 0; color: #ccfbf1; font-size: 12px;">
                      Your trusted community pharmacy • Roysambu, Nairobi
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px;">
              ${bodyContent}
              ${buttonHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center; color: ${BRAND.muted}; font-size: 12px; line-height: 1.5;">
              <p style="margin: 0 0 6px; font-weight: 600; color: ${BRAND.text};">${BRAND.name}</p>
              <p style="margin: 0 0 8px;">${BRAND.location}</p>
              <p style="margin: 0 0 12px;">
                Phone / WhatsApp: <a href="tel:${BRAND.phone}" style="color: ${BRAND.color}; text-decoration: none;">${BRAND.phone}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                You received this notification regarding your activity on Sphere Pharmacy.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function orderConfirmationTemplate(opts: {
  orderReference: string
  customerName?: string | null
  items: Array<{ name: string; qty: number; price: number; lineTotal: number }>
  subtotal: number
  deliveryFee: number
  discountAmount: number
  total: number
  pointsEarned?: number
  fulfillment: "PICKUP" | "DELIVERY"
  deliveryAddress?: string | null
  deliveryArea?: string | null
  pickupCode?: string | null
  orderUrl: string
}): { subject: string; html: string; text: string } {
  const {
    orderReference, customerName, items, subtotal, deliveryFee,
    discountAmount, total, pointsEarned, fulfillment, deliveryAddress,
    deliveryArea, pickupCode, orderUrl,
  } = opts

  const greeting = customerName ? `Hello ${customerName},` : "Hello,"
  const fulfillmentTitle = fulfillment === "DELIVERY" ? "Doorstep Delivery" : "Counter Pickup"
  const fulfillmentDetail = fulfillment === "DELIVERY"
    ? `Delivery address: ${deliveryAddress ?? "Not specified"}${deliveryArea ? ` (${deliveryArea})` : ""}`
    : `Pickup at: ${BRAND.name}, ${BRAND.location}${pickupCode ? ` • Pickup Code: <strong>${pickupCode}</strong>` : ""}`

  const itemsRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: ${BRAND.text}; font-size: 14px;">
            <strong>${item.name}</strong> × ${item.qty}
          </td>
          <td align="right" style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: ${BRAND.text}; font-size: 14px; font-weight: 600;">
            KSh ${item.lineTotal.toLocaleString()}
          </td>
        </tr>
      `
    )
    .join("")

  const html = baseLayout(
    `Order Confirmation — ${orderReference}`,
    `
      <h2 style="margin: 0 0 12px; color: ${BRAND.color}; font-size: 22px; font-weight: 700;">Order Confirmed!</h2>
      <p style="margin: 0 0 20px; font-size: 15px; color: ${BRAND.text};">${greeting}</p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #475569;">
        Thank you for ordering with ${BRAND.name}. We've received order <strong>${orderReference}</strong> and our team is preparing it now.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; font-weight: 700; color: ${BRAND.color}; letter-spacing: 0.05em;">
          Fulfillment: ${fulfillmentTitle}
        </p>
        <p style="margin: 0; font-size: 14px; color: #334155;">
          ${fulfillmentDetail}
        </p>
      </div>

      <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: ${BRAND.text};">Order Items</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        ${itemsRows}
        <tr>
          <td style="padding: 8px 0; color: ${BRAND.muted}; font-size: 14px;">Subtotal</td>
          <td align="right" style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px;">KSh ${subtotal.toLocaleString()}</td>
        </tr>
        ${
          deliveryFee > 0
            ? `
          <tr>
            <td style="padding: 8px 0; color: ${BRAND.muted}; font-size: 14px;">Delivery Fee</td>
            <td align="right" style="padding: 8px 0; color: ${BRAND.text}; font-size: 14px;">KSh ${deliveryFee.toLocaleString()}</td>
          </tr>
        `
            : ""
        }
        ${
          discountAmount > 0
            ? `
          <tr>
            <td style="padding: 8px 0; color: #16a34a; font-size: 14px;">Discount Applied</td>
            <td align="right" style="padding: 8px 0; color: #16a34a; font-size: 14px; font-weight: 600;">-KSh ${discountAmount.toLocaleString()}</td>
          </tr>
        `
            : ""
        }
        <tr>
          <td style="padding: 12px 0; border-top: 2px solid #e2e8f0; font-size: 16px; font-weight: 700; color: ${BRAND.text};">Total</td>
          <td align="right" style="padding: 12px 0; border-top: 2px solid #e2e8f0; font-size: 18px; font-weight: 800; color: ${BRAND.color};">
            KSh ${total.toLocaleString()}
          </td>
        </tr>
      </table>

      ${
        pointsEarned && pointsEarned > 0
          ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; color: #065f46; font-size: 13px;">
          🎉 You will earn <strong>${pointsEarned} Sphere Points</strong> once payment is completed!
        </div>
      `
          : ""
      }
    `,
    { text: "Track Your Order", url: orderUrl }
  )

  const text = `Order Confirmation — ${orderReference}\n\n${greeting}\nThank you for ordering with ${BRAND.name}. Order ${orderReference} is confirmed for KSh ${total.toLocaleString()}.\nFulfillment: ${fulfillmentTitle} (${fulfillmentDetail})\n\nTrack order: ${orderUrl}`

  return { subject: `Order Confirmed: ${orderReference} — ${BRAND.name}`, html, text }
}

export function orderStatusUpdateTemplate(opts: {
  orderReference: string
  customerName?: string | null
  statusLabel: string
  message: string
  pickupCode?: string | null
  orderUrl: string
}): { subject: string; html: string; text: string } {
  const { orderReference, customerName, statusLabel, message, pickupCode, orderUrl } = opts
  const greeting = customerName ? `Hello ${customerName},` : "Hello,"

  const html = baseLayout(
    `Order ${orderReference} Status Update`,
    `
      <h2 style="margin: 0 0 12px; color: ${BRAND.color}; font-size: 20px; font-weight: 700;">Order Update</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text};">${greeting}</p>
      
      <div style="background-color: #f0fdfa; border-left: 4px solid ${BRAND.color}; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0 0 6px; font-size: 12px; text-transform: uppercase; font-weight: 700; color: ${BRAND.color}; letter-spacing: 0.05em;">
          Current Status: ${statusLabel}
        </p>
        <p style="margin: 0; font-size: 15px; color: #134e4a; font-weight: 500;">
          ${message}
        </p>
      </div>

      ${
        pickupCode
          ? `
        <div style="background-color: #f8fafc; border: 2px dashed ${BRAND.color}; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
          <p style="margin: 0 0 4px; font-size: 12px; color: ${BRAND.muted}; text-transform: uppercase; font-weight: 600;">Counter Pickup Code</p>
          <p style="margin: 0; font-size: 26px; font-weight: 800; color: ${BRAND.color}; letter-spacing: 0.1em;">${pickupCode}</p>
          <p style="margin: 6px 0 0; font-size: 12px; color: ${BRAND.muted};">Present this code at our counter on Lumumba Drive, Roysambu.</p>
        </div>
      `
          : ""
      }
    `,
    { text: "View Order Details", url: orderUrl }
  )

  const text = `Order ${orderReference} Update: ${statusLabel}\n\n${greeting}\n${message}\n${pickupCode ? `Pickup code: ${pickupCode}\n` : ""}View order: ${orderUrl}`
  return { subject: `Update on Order ${orderReference}: ${statusLabel} — ${BRAND.name}`, html, text }
}

export function paymentReceiptTemplate(opts: {
  orderReference: string
  customerName?: string | null
  amount: number
  method: string
  pointsEarned?: number
  orderUrl: string
}): { subject: string; html: string; text: string } {
  const { orderReference, customerName, amount, method, pointsEarned, orderUrl } = opts
  const greeting = customerName ? `Hello ${customerName},` : "Hello,"

  const html = baseLayout(
    `Payment Receipt — ${orderReference}`,
    `
      <h2 style="margin: 0 0 12px; color: #16a34a; font-size: 20px; font-weight: 700;">Payment Confirmed</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text};">${greeting}</p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">
        We have received your payment of <strong>KSh ${amount.toLocaleString()}</strong> via <strong>${method}</strong> for order <strong>${orderReference}</strong>.
      </p>

      ${
        pointsEarned && pointsEarned > 0
          ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; color: #065f46; font-size: 14px;">
          ✨ <strong>${pointsEarned} Sphere Points</strong> have been added to your loyalty balance!
        </div>
      `
          : ""
      }
    `,
    { text: "View Order & Receipt", url: orderUrl }
  )

  const text = `Payment Confirmed — ${orderReference}\n\n${greeting}\nPayment of KSh ${amount.toLocaleString()} via ${method} confirmed.\nView order: ${orderUrl}`
  return { subject: `Payment Receipt: KSh ${amount.toLocaleString()} for ${orderReference} — ${BRAND.name}`, html, text }
}

export function prescriptionStatusTemplate(opts: {
  customerName?: string | null
  orderReference?: string | null
  status: "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" | "PARTIALLY_APPROVED"
  reviewNotes?: string | null
  refillsAllowed?: number
  actionUrl: string
}): { subject: string; html: string; text: string } {
  const { customerName, orderReference, status, reviewNotes, refillsAllowed, actionUrl } = opts
  const greeting = customerName ? `Hello ${customerName},` : "Hello,"

  const statusTitles: Record<string, { title: string; color: string; bg: string; border: string }> = {
    APPROVED: { title: "Prescription Approved", color: "#065f46", bg: "#ecfdf5", border: "#10b981" },
    PARTIALLY_APPROVED: { title: "Prescription Partially Approved", color: "#854d0e", bg: "#fefce8", border: "#f59e0b" },
    CLARIFICATION_REQUESTED: { title: "Clarification Needed on Prescription", color: "#854d0e", bg: "#fefce8", border: "#eab308" },
    REJECTED: { title: "Prescription Could Not Be Verified", color: "#991b1b", bg: "#fef2f2", border: "#ef4444" },
  }

  const current = statusTitles[status] || statusTitles.APPROVED

  const html = baseLayout(
    `Prescription Verification Update`,
    `
      <h2 style="margin: 0 0 12px; color: ${BRAND.color}; font-size: 20px; font-weight: 700;">Pharmacist Review Completed</h2>
      <p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.text};">${greeting}</p>
      
      <div style="background-color: ${current.bg}; border-left: 4px solid ${current.border}; padding: 16px 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
        <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 700; color: ${current.color};">
          ${current.title}
        </h3>
        ${
          reviewNotes
            ? `<p style="margin: 6px 0 0; font-size: 14px; color: ${current.color};"><strong>Pharmacist note:</strong> ${reviewNotes}</p>`
            : ""
        }
        ${
          refillsAllowed && refillsAllowed > 0
            ? `<p style="margin: 6px 0 0; font-size: 13px; color: ${current.color};">Refills authorized: <strong>${refillsAllowed}</strong></p>`
            : ""
        }
      </div>

      <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">
        ${
          status === "APPROVED" || status === "PARTIALLY_APPROVED"
            ? "Your prescription has been validated by our licensed pharmacist. You may now complete your order."
            : status === "CLARIFICATION_REQUESTED"
              ? "Please check the pharmacist's note and reply or upload a clearer document."
              : "Our pharmacist was unable to approve the submitted prescription. Please review the notes or contact our pharmacy desk."
        }
      </p>
    `,
    { text: "Open Prescription & Order", url: actionUrl }
  )

  const text = `Prescription Status Update: ${current.title}\n\n${greeting}\n${reviewNotes ? `Pharmacist note: ${reviewNotes}\n` : ""}Check details: ${actionUrl}`
  return { subject: `Prescription Update: ${current.title} — ${BRAND.name}`, html, text }
}

export function backInStockTemplate(opts: {
  productName: string
  price: number
  productUrl: string
}): { subject: string; html: string; text: string } {
  const { productName, price, productUrl } = opts

  const html = baseLayout(
    `${productName} is Back in Stock!`,
    `
      <h2 style="margin: 0 0 12px; color: ${BRAND.color}; font-size: 20px; font-weight: 700;">Back in Stock!</h2>
      <p style="margin: 0 0 20px; font-size: 15px; color: ${BRAND.text};">
        Great news! An item on your watchlist is back in stock at Sphere Pharmacy:
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px; text-align: center;">
        <h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 700; color: ${BRAND.text};">${productName}</h3>
        <p style="margin: 0; font-size: 20px; font-weight: 800; color: ${BRAND.color};">KSh ${price.toLocaleString()}</p>
      </div>
      <p style="margin: 0; font-size: 14px; color: ${BRAND.muted}; text-align: center;">
        Stock is limited. Order now to guarantee same-day dispatch or counter pickup.
      </p>
    `,
    { text: "Order Now", url: productUrl }
  )

  const text = `${productName} is back in stock at ${BRAND.name} for KSh ${price.toLocaleString()}!\nOrder now: ${productUrl}`
  return { subject: `Back in Stock: ${productName} — ${BRAND.name}`, html, text }
}

export function adminNotificationTemplate(opts: {
  title: string
  message: string
  details?: Record<string, string | number>
  actionUrl?: string
  actionLabel?: string
}): { subject: string; html: string; text: string } {
  const { title, message, details, actionUrl, actionLabel } = opts

  const detailsRows = details
    ? Object.entries(details)
        .map(
          ([k, v]) => `
          <tr>
            <td style="padding: 6px 0; color: ${BRAND.muted}; font-size: 13px; font-weight: 600;">${k}</td>
            <td align="right" style="padding: 6px 0; color: ${BRAND.text}; font-size: 13px; font-family: monospace;">${v}</td>
          </tr>
        `
        )
        .join("")
    : ""

  const html = baseLayout(
    `Staff Alert: ${title}`,
    `
      <div style="display: inline-block; background-color: #fef2f2; color: #991b1b; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">
        Staff Alert
      </div>
      <h2 style="margin: 0 0 12px; color: ${BRAND.text}; font-size: 20px; font-weight: 700;">${title}</h2>
      <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">${message}</p>

      ${
        detailsRows
          ? `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailsRows}
          </table>
        </div>
      `
          : ""
      }
    `,
    actionUrl ? { text: actionLabel || "Open Dashboard", url: actionUrl } : undefined
  )

  const text = `Staff Alert: ${title}\n\n${message}\n${actionUrl ? `Dashboard: ${actionUrl}` : ""}`
  return { subject: `[Sphere Staff] ${title}`, html, text }
}


export function serviceBookingTemplate(opts: {
  customerName?: string | null
  reference: string
  serviceName: string
  status: string
  message: string
  start: Date
  end: Date
  bookingUrl: string
}): { subject: string; html: string; text: string } {
  const { customerName, reference, serviceName, status, message, start, end, bookingUrl } = opts
  const greeting = customerName ? `Hello ${customerName},` : "Hello,"
  const when = start.toLocaleString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  })
  const endTime = end.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Nairobi" })
  const html = baseLayout(
    `Service Booking ${reference} — ${status}`,
    `
      <h2 style="margin:0 0 12px;color:${BRAND.color};font-size:22px;font-weight:700;">Care appointment update</h2>
      <p style="margin:0 0 16px;font-size:15px;">${greeting}</p>
      <div style="background:#f0fdfa;border-left:4px solid ${BRAND.color};padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;font-weight:700;color:${BRAND.color};letter-spacing:.05em;">${status}</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#134e4a;">${serviceName}</p>
        <p style="margin:6px 0 0;font-size:14px;color:#475569;">${when} – ${endTime}</p>
      </div>
      <p style="margin:0 0 18px;font-size:14px;color:#475569;">${message}</p>
      <p style="margin:0;font-size:13px;color:${BRAND.muted};">Booking reference: <strong>${reference}</strong></p>
    `,
    { text: "View Care Services", url: bookingUrl }
  )
  const text = `Service booking ${reference} — ${status}\n\n${greeting}\n${serviceName}\n${when} – ${endTime}\n\n${message}\n\n${bookingUrl}`
  return { subject: `Service Booking ${reference}: ${status} — ${BRAND.name}`, html, text }
}
