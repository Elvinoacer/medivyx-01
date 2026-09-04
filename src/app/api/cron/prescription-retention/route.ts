import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { deleteFromR2 } from "@/lib/r2"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const days = Number(process.env.PRESCRIPTION_RETENTION_DAYS)
  if (!Number.isSafeInteger(days) || days < 30 || days > 36_500) return NextResponse.json({ error: "Prescription retention is not configured." }, { status: 503 })
  const cutoff = new Date(Date.now() - days * 86_400_000)
  const candidates = await db.prescription.findMany({ where: { deletedAt: { lte: cutoff } }, select: { id: true, storageKey: true }, take: 100 })
  let removed = 0
  for (const candidate of candidates) {
    if (candidate.storageKey) {
      const references = await db.prescription.count({ where: { id: { not: candidate.id }, storageKey: candidate.storageKey } })
      if (references > 0) continue
      try { await deleteFromR2(candidate.storageKey) } catch { continue }
    }
    const deleted = await db.prescription.deleteMany({ where: { id: candidate.id, deletedAt: { lte: cutoff } } })
    removed += deleted.count
  }
  return NextResponse.json({ ok: true, removed })
}
