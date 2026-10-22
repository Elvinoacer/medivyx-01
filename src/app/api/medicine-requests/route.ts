import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { medicineRequestSchema, MEDICINE_PHOTO_MAX_BYTES } from "@/lib/medicine-requests"
import { deleteFromR2, uploadToR2 } from "@/lib/r2"
import { validateFile } from "@/lib/security/file"
import { enforceRateLimit, publicError, rejectOversizedRequest } from "@/lib/security/request"

const MAX_BODY_BYTES = Math.ceil(MEDICINE_PHOTO_MAX_BYTES / 3) * 4 + 4096

// Guest requests are intentional: a callback number is enough to follow up.
export async function POST(request: Request) {
  const tooLarge = rejectOversizedRequest(request, MAX_BODY_BYTES)
  if (tooLarge) return tooLarge
  let storageKey: string | null = null
  let saved = false
  try {
    const limited = await enforceRateLimit(request, "medicine-request-create", 10, 60 * 60 * 1000)
    if (limited) return limited

    // Bound streamed bodies too, even when Content-Length is absent.
    const reader = request.body?.getReader()
    if (!reader) return NextResponse.json({ error: "Enter your medicine and phone number." }, { status: 400 })
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > MAX_BODY_BYTES) {
          await reader.cancel()
          return NextResponse.json({ error: "Photo is too large — 3MB maximum." }, { status: 413 })
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    let body: unknown
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch {
      return NextResponse.json({ error: "Invalid request. Please try again." }, { status: 400 })
    }
    const parsed = medicineRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { medicineName, phone, photo } = parsed.data

    if (photo) {
      const buffer = Buffer.from(photo.data, "base64")
      const invalid = validateFile(buffer, photo.type, photo.name, MEDICINE_PHOTO_MAX_BYTES)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
      const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[photo.type]
      storageKey = `medicine-requests/${randomUUID()}.${extension}`
      await uploadToR2({ key: storageKey, body: buffer, contentType: photo.type, access: "private" })
    }

    const row = await db.medicineRequest.create({
      data: { medicineName, phone, storageKey, photoName: photo?.name, photoType: photo?.type },
      select: { id: true },
    })
    saved = true
    return NextResponse.json({ id: row.id }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch {
    if (storageKey && !saved) {
      try { await deleteFromR2(storageKey) } catch { console.error("Medicine request photo cleanup failed") }
    }
    return publicError("Could not save your medicine request. Please try again.")
  }
}
