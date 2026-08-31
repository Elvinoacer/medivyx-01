import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto"

// Password hashing with scrypt (no external deps)

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":")
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, "hex")
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export function orderReference(): string {
  return `SPH-${randomBytes(3).toString("hex").toUpperCase()}${Date.now().toString(36).slice(-3).toUpperCase()}`
}

export function pickupCode(): string {
  return String(createHash("md5").update(randomBytes(8)).digest("hex").slice(0, 4)).toUpperCase()
}

export function otpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}
