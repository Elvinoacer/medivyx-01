/**
 * Safaricom Daraja M-Pesa STK Push (Lipa Na M-Pesa Online) Integration.
 *
 * Supports live and Safaricom sandbox environments. Missing credentials fail closed.
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
  const configured = Boolean(
    process.env.MPESA_CONSUMER_KEY &&
    process.env.MPESA_CONSUMER_SECRET &&
    process.env.MPESA_PASSKEY &&
    process.env.MPESA_SHORTCODE &&
    process.env.MPESA_CALLBACK_TOKEN && process.env.MPESA_CALLBACK_TOKEN.length >= 24
  )
  return configured && (process.env.NODE_ENV !== "production" || process.env.MPESA_ENVIRONMENT === "production")
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
    signal: AbortSignal.timeout(12_000),
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Daraja OAuth authentication failed (${response.status})`)
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
  const { phone, amount, reference, description = "Medivyx Order" } = params
  const formattedPhone = formatDarajaPhone(phone)

  if (!isDarajaConfigured()) {
    throw new Error("M-Pesa is not configured")
  }

  const token = await getDarajaAccessToken()
  const shortcode = process.env.MPESA_SHORTCODE!
  const passkey = process.env.MPESA_PASSKEY!
  const timestamp = getTimestamp()
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://medivyx.co.ke"
  const callbackToken = process.env.MPESA_CALLBACK_TOKEN
  if (!callbackToken || callbackToken.length < 24) throw new Error("MPESA_CALLBACK_TOKEN must contain at least 24 characters")
  const defaultCallback = `${appUrl}/api/payments/mpesa/callback?token=${encodeURIComponent(callbackToken)}`
  const callback = new URL(params.callbackUrl || process.env.MPESA_CALLBACK_URL || defaultCallback)
  if (process.env.NODE_ENV === "production" && callback.protocol !== "https:") throw new Error("M-Pesa callbacks require HTTPS")
  callback.searchParams.set("token", callbackToken)
  const callbackUrl = callback.href

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
    signal: AbortSignal.timeout(15_000),
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
    throw new Error("M-Pesa is not configured")
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
    signal: AbortSignal.timeout(15_000),
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
