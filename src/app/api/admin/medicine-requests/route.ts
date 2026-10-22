import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"
import { MEDICINE_REQUEST_STATUSES, medicineRequestUpdateSchema } from "@/lib/medicine-requests"
import { toMedicineRequestDTO } from "@/lib/medicine-request-dto"
import { publicError, rejectOversizedRequest } from "@/lib/security/request"

export async function GET(request: Request) {
  const { error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
  if (error) return error
  try {
    const params = new URL(request.url).searchParams
    const status = params.get("status")
    if (status && !MEDICINE_REQUEST_STATUSES.some((value) => value === status)) {
      return NextResponse.json({ error: "Invalid request status." }, { status: 400 })
    }
    const pageValue = Number(params.get("page")) || 1
    const page = Number.isSafeInteger(pageValue) ? Math.min(10000, Math.max(1, pageValue)) : 1
    const pageSize = 25
    const search = (params.get("search") || "").trim().slice(0, 200)
    const where: Prisma.MedicineRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(search ? { OR: [
        { medicineName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ] } : {}),
    }
    const [rows, total] = await Promise.all([
      db.medicineRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.medicineRequest.count({ where }),
    ])
    return NextResponse.json({ items: rows.map(toMedicineRequestDTO), total, page, pageSize }, { headers: { "Cache-Control": "private, no-store" } })
  } catch { return publicError("Could not load medicine requests.") }
}

export async function PATCH(request: Request) {
  const { session, error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
  if (error) return error
  const tooLarge = rejectOversizedRequest(request, 8192)
  if (tooLarge) return tooLarge
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }
  const parsed = medicineRequestUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { id, status, staffNotes } = parsed.data
  try {
    const row = await db.$transaction(async (tx) => {
      const existing = await tx.medicineRequest.findUnique({ where: { id } })
      if (!existing) return null
      const updated = await tx.medicineRequest.update({ where: { id }, data: { status, staffNotes: staffNotes || null } })
      await tx.auditLog.create({ data: {
        actor: session.staffName || session.staffId!, actorRole: session.staffRole,
        action: "UPDATE_MEDICINE_REQUEST", entity: "MedicineRequest", entityId: id,
        details: JSON.stringify({ previousStatus: existing.status, status }),
      } })
      return updated
    })
    if (!row) return NextResponse.json({ error: "Medicine request not found." }, { status: 404 })
    return NextResponse.json(toMedicineRequestDTO(row), { headers: { "Cache-Control": "private, no-store" } })
  } catch { return publicError("Could not update the medicine request.") }
}
