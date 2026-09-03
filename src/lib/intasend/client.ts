/**
 * IntaSend Payment Gateway Integration for Card Payments (Visa / Mastercard) in Kenya.
 *
 * Licensed by Central Bank of Kenya (CBK). Native KES settlement with zero FX friction.
 * Supports both Checkout Sessions (hosted/inline modal) and direct card processing with 3D Secure.
 * Fallback to development simulation when keys are absent in local test environments.
 */

function getBaseUrl(): string {
  const env = (process.env.INTASEND_ENVIRONMENT || "sandbox").toLowerCase()
  return env === "production"
    ? "https://payment.intasend.com/api/v1"
    : "https://sandbox.intasend.com/api/v1"
}

export function isIntaSendConfigured(): boolean {
  return Boolean(process.env.INTASEND_SECRET_KEY || process.env.INTASEND_PUBLISHABLE_KEY)
}

export interface IntaSendCardPayload {
  number: string
  name: string
  expiry: string // MM/YY
  cvv: string
}

export interface IntaSendChargeParams {
  orderId: string
  reference: string
  amount: number
  customer: {
    name: string
    email?: string | null
    phone?: string | null
  }
  card: IntaSendCardPayload
}

export interface IntaSendChargeResult {
  paymentId: string
  status: "SUCCESS" | "FAILED" | "PROCESSING" | "REQUIRES_3DS"
  reference?: string
  redirectUrl?: string
  failureReason?: string
  simulated?: boolean
}

export interface IntaSendCheckoutSessionParams {
  orderId: string
  reference: string
  amount: number
  customer: {
    name: string
    email?: string | null
    phone?: string | null
  }
  redirectUrl?: string
}

export interface IntaSendCheckoutSessionResult {
  url: string
  id: string
  signature?: string
  simulated?: boolean
}

/**
 * Creates an IntaSend hosted checkout session or inline modal checkout.
 */
export async function createIntaSendCheckoutSession(
  params: IntaSendCheckoutSessionParams
): Promise<IntaSendCheckoutSessionResult> {
  const { reference, amount, customer, redirectUrl } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"

  if (!isIntaSendConfigured()) {
    console.info(`[IntaSend Simulated Checkout] Created checkout session for ${reference} (KSh ${amount})`)
    return {
      url: `${appUrl}/#order-${params.orderId}`,
      id: `sim_session_${Date.now()}`,
      simulated: true,
    }
  }

  const pubKey = process.env.INTASEND_PUBLISHABLE_KEY
  const secretKey = process.env.INTASEND_SECRET_KEY

  const names = customer.name.trim().split(" ")
  const firstName = names[0] || "Valued"
  const lastName = names.slice(1).join(" ") || "Customer"

  const payload = {
    public_key: pubKey,
    first_name: firstName,
    last_name: lastName,
    email: customer.email || "customer@spherepharmacy.co.ke",
    phone_number: customer.phone || "254700000000",
    host: appUrl,
    amount: Math.round(amount),
    currency: "KES",
    api_ref: reference,
    redirect_url: redirectUrl || `${appUrl}/#order-${params.orderId}`,
    card_tarrif: "BUSINESS-PAYS",
  }

  const url = `${getBaseUrl()}/checkout/`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`IntaSend Checkout Error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return {
    url: data.url,
    id: data.id,
    signature: data.signature,
    simulated: false,
  }
}

/**
 * Charges a credit or debit card through IntaSend.
 * Validates card format and handles 3DS redirect or simulation.
 */
export async function chargeIntaSendCard(
  params: IntaSendChargeParams
): Promise<IntaSendChargeResult> {
  const { reference, amount, card } = params
  const number = card.number.replace(/\s+/g, "")

  // Validate format
  if (!/^\d{13,19}$/.test(number)) {
    return { paymentId: "", status: "FAILED", failureReason: "Enter a valid card number." }
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry)) {
    return { paymentId: "", status: "FAILED", failureReason: "Expiry must be MM/YY." }
  }
  const [mm, yy] = card.expiry.split("/").map(Number)
  const now = new Date()
  const expYear = 2000 + yy
  if (expYear < now.getFullYear() || (expYear === now.getFullYear() && mm < now.getMonth() + 1)) {
    return { paymentId: "", status: "FAILED", failureReason: "This card has expired." }
  }
  if (!/^\d{3,4}$/.test(card.cvv)) {
    return { paymentId: "", status: "FAILED", failureReason: "Enter the 3-digit CVV." }
  }

  // Simulated fallback or demo testing rules
  if (!isIntaSendConfigured() || process.env.INTASEND_MOCK_TEST === "true") {
    // Card decline testing rule: numbers ending 0000 or CVV 000 simulate decline
    const declined = number.endsWith("0000") || card.cvv === "000"
    if (declined) {
      return {
        paymentId: `IS_DEC_${Date.now()}`,
        status: "FAILED",
        failureReason: "Card declined by issuing bank (insufficient funds or 3DS cancelled).",
        simulated: true,
      }
    }

    const providerRef = `INT-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).slice(-2).toUpperCase()}`
    console.info(`[IntaSend Simulated Charge] Approved card ending ${number.slice(-4)} for KSh ${amount} (${reference}) Ref: ${providerRef}`)
    return {
      paymentId: `IS_PAY_${Date.now()}`,
      status: "SUCCESS",
      reference: providerRef,
      simulated: true,
    }
  }

  // Live IntaSend API Charge
  try {
    const secretKey = process.env.INTASEND_SECRET_KEY
    const pubKey = process.env.INTASEND_PUBLISHABLE_KEY

    const payload = {
      public_key: pubKey,
      card_number: number,
      cvv: card.cvv,
      expiration_month: String(mm).padStart(2, "0"),
      expiration_year: String(expYear),
      amount: Math.round(amount),
      currency: "KES",
      api_ref: reference,
      name: card.name,
      email: params.customer.email || "customer@spherepharmacy.co.ke",
    }

    const url = `${getBaseUrl()}/processing/charge/`
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      return {
        paymentId: data.id || "",
        status: "FAILED",
        failureReason: data.detail || data.message || "Card transaction was rejected.",
      }
    }

    if (data.url) {
      // 3D Secure verification challenge required
      return {
        paymentId: data.id || "",
        status: "REQUIRES_3DS",
        redirectUrl: data.url,
      }
    }

    if (data.state === "COMPLETE") {
      return {
        paymentId: data.id,
        status: "SUCCESS",
        reference: data.invoice_id || data.tracking_id,
      }
    }

    return {
      paymentId: data.id || "",
      status: "PROCESSING",
      reference: data.invoice_id,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "IntaSend gateway connection error"
    return {
      paymentId: "",
      status: "FAILED",
      failureReason: msg,
    }
  }
}

/**
 * Verify payment status by invoice or tracking id with IntaSend.
 */
export async function checkIntaSendStatus(invoiceId: string): Promise<{ state: string; confirmed: boolean }> {
  if (!isIntaSendConfigured()) {
    return { state: "COMPLETE", confirmed: true }
  }

  const pubKey = process.env.INTASEND_PUBLISHABLE_KEY
  const secretKey = process.env.INTASEND_SECRET_KEY
  const url = `${getBaseUrl()}/payment/status/`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secretKey}`,
    },
    body: JSON.stringify({
      invoice_id: invoiceId,
      public_key: pubKey,
    }),
  })

  if (!response.ok) {
    return { state: "UNKNOWN", confirmed: false }
  }

  const data = await response.json()
  const state = String(data.invoice?.state ?? "").toUpperCase()
  return {
    state,
    confirmed: state === "COMPLETE",
  }
}
