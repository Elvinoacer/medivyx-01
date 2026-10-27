import { createHash, randomBytes } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { clientIp } from "@/lib/security/request"
import { tokenHash } from "@/lib/hash"

export const PROMO_DEVICE_COOKIE = "sphere_promo_device"

export function promoBrowserId(request: NextRequest): string | null {
  const token = request.cookies.get(PROMO_DEVICE_COOKIE)?.value
  return token && /^[A-Za-z0-9_-]{24,96}$/.test(token) ? token : null
}

/**
 * Pseudonymous redemption identifiers.
 *
 * IP addresses have low entropy and MUST only be hashed with a stable secret.
 * If the production hash key is missing, ipHash stays null: IP-limited offers
 * are explicitly rejected by the checkout/validation guards (fail closed).
 *
 * Browser cookies are high-entropy random tokens generated with randomBytes(24).
 * An unkeyed SHA-256 digest of this opaque token is safe as a compatibility
 * fallback for browser-only offers when a deployment lacks the HMAC secret.
 * Keep HMAC identifiers unchanged whenever a valid secret is configured so
 * existing browser redemption counts retain their meaning.
 */
export function promotionIdentity(request: NextRequest) {
  const ip = clientIp(request)
  const device = promoBrowserId(request)
  const secret = process.env.TOKEN_HASH_SECRET || process.env.SESSION_SECRET
  const hasSecureKey = Boolean(secret && secret.length >= 32)
  const ipHash = ip !== "unknown" && hasSecureKey ? tokenHash("promo:ip:v1:" + ip) : null
  const browserHash = device
    ? hasSecureKey
      ? tokenHash("promo:browser:v1:" + device)
      : createHash("sha256").update("promo:browser:v1:" + device).digest("hex")
    : null
  return { ipHash, browserHash }
}

export function withPromoDeviceCookie(response: NextResponse, request: NextRequest): NextResponse {
  if (!promoBrowserId(request)) {
    response.cookies.set(PROMO_DEVICE_COOKIE, randomBytes(24).toString("base64url"), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: 60 * 60 * 24 * 365,
    })
  }
  return response
}

// HTML date inputs represent Kenya-local calendar days, not UTC instants.
export function promotionDate(value: unknown, end: boolean): Date | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string") throw new Error("Choose a valid promotion date.")
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const check = new Date(value + "T12:00:00+03:00")
    const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(check)
    const part = (type:string)=>parts.find(x=>x.type===type)?.value||""
    if (!Number.isFinite(check.getTime()) || [part("year"),part("month"),part("day")].join("-")!==value) throw new Error("Choose a valid calendar date.")
    return new Date(value + (end ? "T23:59:59.999+03:00" : "T00:00:00+03:00"))
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) throw new Error("Choose a valid promotion date.")
  return parsed
}

export function promotionStatus(p:{active:boolean;startsAt:Date|null;endsAt:Date|null}, now=new Date()) {
  if (!p.active) return "paused"
  if (p.startsAt && p.startsAt > now) return "scheduled"
  if (p.endsAt && p.endsAt < now) return "expired"
  return "live"
}

export function promotionLimitFields(body: Record<string,unknown>) {
  const result: Record<string,number|null> = {}
  for (const [key,label] of [["maxUses","Total redemption limit"],["perUserLimit","Per-customer limit"],["perIpLimit","Per-network limit"],["perBrowserLimit","Per-browser limit"]] as const) {
    if (body[key] === undefined) continue
    const raw=body[key]
    if (raw===null || raw==="") {result[key]=null;continue}
    const value=Number(raw)
    if (!Number.isSafeInteger(value) || value<1 || value>1000000) throw new Error(label+" must be a whole number between 1 and 1,000,000.")
    result[key]=value
  }
  return result
}

export function promotionCode(value:unknown):string|null{
  if (value===null || value===undefined || value==="") return null
  const code=String(value).trim().toUpperCase()
  if(!/^[A-Z0-9_-]{3,32}$/.test(code))throw new Error("Promo code must be 3–32 letters, numbers, underscores or hyphens.")
  return code
}

export function promotionDiscount(value:unknown):number|null{
  if(value===null||value===undefined||value==="")return null
  const n=Number(value)
  if(!Number.isInteger(n)||n<1||n>90)throw new Error("Discount must be a whole percentage from 1% to 90%.")
  return n
}
