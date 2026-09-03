/**
 * Safaricom Daraja M-Pesa STK Push (Lipa Na M-Pesa Online) Integration.
 *
 * Supports both Live Safaricom Daraja APIs and Sandbox environments.
 * When Daraja credentials are not set in .env, gracefully runs high-fidelity
 * development simulation so testing proceeds smoothly without crashing.
 */

interface DarajaTokenCache {
  accessToken: string
  expiresAt: number // timestamp in ms
}

let tokenCache: DarajaTokenCache | null = null

function getBaseUrl(): string {
  const env = (process.env.MPESA_ENVIRONMENT || "sandbox").toLowerCase()
  return env === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke"
}

export function isDarajaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_SHORTCODE
  )
}

/** Format phone to Daraja standard: 2547XXXXXXXX or 2541XXXXXXXX */
export function formatDarajaPhone(raw: string): string {
  const cleaned = raw.replace(/\D/g, "")
  if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned
  if (cleaned.startsWith("0") && cleaned.length === 10) return `254${cleaned.slice(1)}`
  if (cleaned.length === 9 && (cleaned.startsWith("7") || cleaned.startsWith("1"))) return `254${cleaned}`
  return cleaned
}

/** Formats current date to YYYYMMDDHHmmss */
function getTimestamp(): string {
  const now = new Date()
  const Y = now.getFullYear()
  const M = String(now.getMonth() + 1).padStart(2, "0")
  const D = String(now.getDate()).padStart(2, "0")
  const h = String(now.getHours()).padStart(2, "0")
  const m = String(now.getMinutes()).padStart(2, "0")
  const s = String(now.getSeconds()).padStart(2, "0")
  return `${Y}${M}${D}${h}${m}${s}`
}

/** Generate or retrieve cached OAuth Bearer access token from Safaricom */
export async function getDarajaAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET

  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET in environment")
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")
  const url = `${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Daraja OAuth authentication failed (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as { access_token: string; expires_in: string }
  const expiresInMs = (parseInt(data.expires_in, 10) || 3599) * 1000

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + expiresInMs,
  }

  return tokenCache.accessToken
}

export interface StkPushParams {
  phone: string
  amount: number
  reference: string
  description?: string
  callbackUrl?: string
}

export interface StkPushResponse {
  merchantRequestId: string
  checkoutRequestId: string
  customerMessage: string
  responseCode: string
  simulated?: boolean
}

/**
 * Triggers an M-Pesa STK Push to the customer's phone.
 */
export async function initiateStkPush(params: StkPushParams): Promise<StkPushResponse> {
  const { phone, amount, reference, description = "Sphere Pharmacy Order" } = params
  const formattedPhone = formatDarajaPhone(phone)

  if (!isDarajaConfigured()) {
    // Development fallback: simulated checkoutRequestId
    const mockCheckoutId = `ws_CO_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
    console.info(`[Daraja M-Pesa Simulated] STK Push sent to ${formattedPhone} for KSh ${amount} (Order: ${reference}) CheckoutRequestId: ${mockCheckoutId}`)
    return {
      merchantRequestId: `MR_${Date.now()}`,
      checkoutRequestId: mockCheckoutId,
      customerMessage: `STK Push sent to ${formattedPhone}. Enter your M-Pesa PIN on your phone to authorise KSh ${amount}.`,
      responseCode: "0",
      simulated: true,
    }
  }

  const token = await getDarajaAccessToken()
  const shortcode = process.env.MPESA_SHORTCODE!
  const passkey = process.env.MPESA_PASSKEY!
  const timestamp = getTimestamp()
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
  const defaultCallback = `${appUrl}/api/payments/mpesa/callback`
  const callbackUrl = params.callbackUrl || process.env.MPESA_CALLBACK_URL || defaultCallback

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
    Amount: Math.round(amount),
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: callbackUrl,
    AccountReference: reference.slice(0, 12),
    TransactionDesc: description.slice(0, 13),
  }

  const url = `${getBaseUrl()}/mpesa/stkpush/v1/processrequest`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const resJson = await response.json()

  if (!response.ok || resJson.ResponseCode !== "0") {
    const errorMsg = resJson.errorMessage || resJson.ResponseDescription || "M-Pesa STK push request failed"
    throw new Error(`Safaricom STK Error: ${errorMsg}`)
  }

  return {
    merchantRequestId: resJson.MerchantRequestID,
    checkoutRequestId: resJson.CheckoutRequestID,
    customerMessage: resJson.CustomerMessage || "STK Push sent to your phone. Enter your PIN to authorise.",
    responseCode: resJson.ResponseCode,
    simulated: false,
  }
}

export interface StkQueryResponse {
  resultCode: string
  resultDesc: string
  status: "SUCCESS" | "FAILED" | "PENDING"
}

/**
 * Queries Daraja STK Push status in real-time.
 */
export async function queryStkPush(checkoutRequestId: string): Promise<StkQueryResponse> {
  if (!isDarajaConfigured()) {
    // In dev mode without Daraja credentials
    return {
      resultCode: "0",
      resultDesc: "Simulated completion in demo environment",
      status: "PENDING",
    }
  }

  const token = await getDarajaAccessToken()
  const shortcode = process.env.MPESA_SHORTCODE!
  const passkey = process.env.MPESA_PASSKEY!
  const timestamp = getTimestamp()
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64")

  const payload = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  }

  const url = `${getBaseUrl()}/mpesa/stkpushquery/v1/query`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const resJson = await response.json()

  const resultCode = String(resJson.ResultCode ?? "")
  const resultDesc = resJson.ResultDesc || resJson.ResponseDescription || ""

  if (resultCode === "0") {
    return { resultCode, resultDesc, status: "SUCCESS" }
  }

  // 1032 = Cancelled by user, 1037 = Timeout, 1 = Insufficient balance, 2001 = Invalid PIN
  if (["1032", "1037", "1", "2001", "1019"].includes(resultCode)) {
    return { resultCode, resultDesc, status: "FAILED" }
  }

  return { resultCode, resultDesc, status: "PENDING" }
}
