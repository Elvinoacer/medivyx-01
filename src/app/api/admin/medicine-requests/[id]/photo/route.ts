import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
import { getObjectFromR2 } from "@/lib/r2"
import { publicError } from "@/lib/security/request"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
  if (error) return error
  try {
    const { id } = await params
    const row = await db.medicineRequest.findUnique({ where: { id } })
    if (!row?.storageKey || !row.photoType) return NextResponse.json({ error: "Photo not found." }, { status: 404 })
    const photo = await getObjectFromR2(row.storageKey)
    return new Response(new Uint8Array(photo.body), { headers: {
      "Content-Type": row.photoType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    } })
  } catch { return publicError("Could not load the medicine photo.") }
}
