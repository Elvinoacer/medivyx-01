import { timingSafeEqual, createHmac } from "crypto"

function configured(): { publishableKey: string; secretKey: string } {
  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY
  const secretKey = process.env.INTASEND_SECRET_KEY
  if (!isIntaSendConfigured()) throw new Error("IntaSend is not configured")
  return { publishableKey: publishableKey!, secretKey: secretKey! }
}

function baseUrl(): string {
  return process.env.INTASEND_ENVIRONMENT === "production" ? "https://api.intasend.com/api/v1" : "https://sandbox.intasend.com/api/v1"
}

export function isIntaSendConfigured(): boolean {
  const configured = Boolean(process.env.INTASEND_PUBLISHABLE_KEY && process.env.INTASEND_SECRET_KEY && process.env.INTASEND_WEBHOOK_SECRET && process.env.INTASEND_WEBHOOK_SECRET.length >= 24)
  return configured && (process.env.NODE_ENV !== "production" || process.env.INTASEND_ENVIRONMENT === "production")
}

export interface IntaSendCheckoutSessionParams {
  orderId: string
  reference: string
  amount: number
  customer: { name: string; email?: string | null; phone?: string | null }
  redirectUrl?: string
}

export async function createIntaSendCheckoutSession(params: IntaSendCheckoutSessionParams): Promise<{ url: string; id: string }> {
  const { publishableKey, secretKey } = configured()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is required for hosted checkout")
  if (!Number.isFinite(params.amount) || params.amount <= 0) throw new Error("Invalid checkout amount")
  if (process.env.NODE_ENV === "production" && new URL(appUrl).protocol !== "https:") throw new Error("Hosted checkout requires HTTPS")
  const names = params.customer.name.trim().split(/\s+/)
  const response = await fetch(`${baseUrl()}/checkout/`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}`, "X-IntaSend-Public-API-Key": publishableKey },
    body: JSON.stringify({
      public_key: publishableKey,
      first_name: names[0] || "Customer",
      last_name: names.slice(1).join(" ") || "Customer",
      email: params.customer.email || undefined,
      phone_number: params.customer.phone || undefined,
      host: appUrl,
      amount: params.amount.toFixed(2),
      currency: "KES",
      api_ref: params.reference,
      redirect_url: params.redirectUrl || `${appUrl}/orders/${params.orderId}`,
      method: "CARD-PAYMENT",
      card_tarrif: "BUSINESS-PAYS",
    }),
  })
  if (!response.ok) throw new Error(`IntaSend checkout could not be created (${response.status})`)
  const data = await response.json() as { url?: string; id?: string; invoice_id?: string }
  const id = data.invoice_id || data.id
  if (!data.url || !id) throw new Error("IntaSend returned an incomplete checkout response")
  const checkoutUrl = new URL(data.url)
  if (checkoutUrl.protocol !== "https:" || !["payment.intasend.com", "sandbox.intasend.com", "checkout.intasend.com"].includes(checkoutUrl.hostname)) throw new Error("Unexpected hosted checkout URL")
  return { url: checkoutUrl.href, id }
}

export interface IntaSendInvoice { id: string; state: string; amount: number; currency: string; apiRef: string; trackingId?: string }

export async function getIntaSendInvoice(invoiceId: string, checkout = false): Promise<IntaSendInvoice> {
  const { publishableKey, secretKey } = configured()
  const response = await fetch(`${baseUrl()}/payment/status/`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}`, "X-IntaSend-Public-API-Key": publishableKey },
    body: JSON.stringify({ ...(checkout ? { checkout_id: invoiceId } : { invoice_id: invoiceId }), public_key: publishableKey }),
  })
  if (!response.ok) throw new Error(`IntaSend verification failed (${response.status})`)
  const data = await response.json() as { invoice?: Record<string, unknown> }
  const invoice = data.invoice || {}
  return {
    id: String(invoice.invoice_id || invoice.id || invoiceId),
    state: String(invoice.state || "UNKNOWN").toUpperCase(),
    amount: Number(invoice.value ?? invoice.amount ?? 0),
    currency: String(invoice.currency || "").toUpperCase(),
    apiRef: String(invoice.api_ref || ""),
    trackingId: invoice.tracking_id ? String(invoice.tracking_id) : undefined,
  }
}

export function verifyIntaSendWebhook(rawBody: string, headers: Headers): boolean {
  const secret = process.env.INTASEND_WEBHOOK_SECRET
  if (!secret || secret.length < 24) return false
  // IntaSend's documented webhook authentication is the configured body challenge.
  try {
    const body = JSON.parse(rawBody)
    if (typeof body.challenge === "string" && safeEqual(body.challenge, secret)) return true
  } catch { return false }
  const provided = headers.get("x-intasend-signature") || headers.get("x-webhook-signature") || ""
  const direct = headers.get("x-intasend-webhook-secret") || ""
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  return safeEqual(provided.replace(/^sha256=/, ""), expected) || safeEqual(direct, secret)
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

export async function checkIntaSendStatus(invoiceId: string): Promise<{ state: string; confirmed: boolean }> {
  const invoice = await getIntaSendInvoice(invoiceId)
  return { state: invoice.state, confirmed: invoice.state === "COMPLETE" }
}

export interface IntaSendRefund { id: string; state: string; amount: number; invoiceId: string }

export async function createIntaSendRefund(invoiceId: string, amount: number, reason: string, details: string): Promise<IntaSendRefund> {
  const { publishableKey, secretKey } = configured()
  const response = await fetch(`${baseUrl()}/chargebacks/`, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secretKey}`, INTASEND_PUBLIC_API_KEY: publishableKey },
    body: JSON.stringify({ public_key: publishableKey, invoice: invoiceId, amount: amount.toFixed(2), reason, reason_details: details }),
  })
  if (!response.ok) throw new Error(`IntaSend refund request failed (${response.status})`)
  return parseRefund(await response.json(), invoiceId, amount)
}

export async function getIntaSendRefund(refundId: string): Promise<IntaSendRefund> {
  const { secretKey } = configured()
  const response = await fetch(`${baseUrl()}/chargebacks/${encodeURIComponent(refundId)}/`, { headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" }, cache: "no-store" })
  if (!response.ok) throw new Error(`IntaSend refund verification failed (${response.status})`)
  return parseRefund(await response.json(), "", 0)
}

function parseRefund(value: unknown, fallbackInvoice: string, fallbackAmount: number): IntaSendRefund {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const id = String(data.chargeback_id || data.id || data.reference || "")
  if (!id) throw new Error("IntaSend returned an incomplete refund response")
  return {
    id,
    state: String(data.state || data.status || "PENDING").toUpperCase(),
    amount: Number(data.amount ?? fallbackAmount),
    invoiceId: String(data.invoice_id || data.invoice || fallbackInvoice),
  }
}
