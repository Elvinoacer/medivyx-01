import { createHash, randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown"
}

function opaqueKey(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowMs: number, identity?: string): Promise<NextResponse | null> {
  const now = new Date()
  const key = `${scope}:${opaqueKey(`${clientIp(request)}:${identity ?? ""}`)}`
  const existing = await db.rateLimitBucket.findUnique({ where: { key } })
  let count: number
  let windowEnds: Date
  if (!existing || existing.windowEnds <= now) {
    windowEnds = new Date(now.getTime() + windowMs)
    const row = await db.rateLimitBucket.upsert({ where: { key }, create: { key, count: 1, windowEnds }, update: { count: 1, windowEnds } })
    count = row.count
  } else {
    const row = await db.rateLimitBucket.update({ where: { key }, data: { count: { increment: 1 } } })
    count = row.count
    windowEnds = row.windowEnds
  }
  if (count <= limit) return null
  const retryAfter = Math.max(1, Math.ceil((windowEnds.getTime() - now.getTime()) / 1000))
  return NextResponse.json({ error: "Too many requests. Please wait and try again." }, { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } })
}

export function rejectOversizedRequest(request: Request, maxBytes: number): NextResponse | null {
  const raw = request.headers.get("content-length")
  if (!raw) return null
  const length = Number(raw)
  if (!Number.isSafeInteger(length) || length < 0 || length > maxBytes) return NextResponse.json({ error: "Request body is too large." }, { status: 413 })
  return null
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002")
}

export function publicError(message: string, status = 500): NextResponse {
  const errorId = randomUUID()
  console.error(JSON.stringify({ level: "error", errorId, message }))
  return NextResponse.json({ error: message, errorId }, { status, headers: { "Cache-Control": "no-store" } })
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}
