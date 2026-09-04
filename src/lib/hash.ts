import { createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto"
const PASSWORD_MIN = 10
const PASSWORD_MAX = 128

function scryptKey(password: string, salt: string | Buffer, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))
  })
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`
  if (!/[a-z]/i.test(password) || !/\d/.test(password)) return "Password must include a letter and a number."
  return null
}

export async function hashPassword(password: string): Promise<string> {
  const policyError = validatePassword(password)
  if (policyError) throw new Error(policyError)
  const salt = randomBytes(16)
  const hash = await scryptKey(password, salt, 64)
  return `scrypt$v=1$N=16384,r=8,p=1$${salt.toString("hex")}$${hash.toString("hex")}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length > PASSWORD_MAX) return false
  try {
    const parts = stored.split("$")
    if (parts[0] === "scrypt" && parts.length === 5) {
      const salt = Buffer.from(parts[3]!, "hex")
      const expected = Buffer.from(parts[4]!, "hex")
      const candidate = await scryptKey(password, salt, expected.length)
      return candidate.length === expected.length && timingSafeEqual(candidate, expected)
    }
    const [legacySalt, legacyHash] = stored.split(":")
    if (!legacySalt || !legacyHash) return false
    const expected = Buffer.from(legacyHash, "hex")
    const candidate = await scryptKey(password, legacySalt, expected.length)
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export function newOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

export function tokenHash(token: string): string {
  return createHmac("sha256", requiredSecret("TOKEN_HASH_SECRET")).update(token).digest("hex")
}

export function orderReference(): string {
  return `SPH-${randomBytes(6).toString("hex").toUpperCase()}`
}

export function pickupCode(): string {
  return String(randomInt(10_000_000, 100_000_000))
}

export function otpCode(): string {
  return String(randomInt(100000, 1000000))
}

export function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", requiredSecret("OTP_HASH_SECRET")).update(`${phone}:${code}`).digest("hex")
}

export function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, "hex")
    const b = Buffer.from(right, "hex")
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

function requiredSecret(name: "OTP_HASH_SECRET" | "TOKEN_HASH_SECRET"): string {
  const value = process.env[name] || process.env.SESSION_SECRET
  if (!value || value.length < 32) throw new Error(`${name} (or SESSION_SECRET) must contain at least 32 characters.`)
  return value
}
