import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toAddressDTO } from "@/lib/dto"
import { requireCustomer } from "@/lib/session"
import { rejectOversizedRequest } from "@/lib/security/request"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const oversized = rejectOversizedRequest(request, 16_384)
  if (oversized) return oversized
  const { id } = await params
  const addr = await db.address.findFirst({ where: { id, userId: session.userId! } })
  if (!addr) return NextResponse.json({ error: "Address not found." }, { status: 404 })
  try {
    const body = await request.json()
    if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") return NextResponse.json({ error: "isDefault must be true or false." }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (body.label !== undefined) { const label = String(body.label).trim() || "Home"; if (label.length > 80) return NextResponse.json({ error: "Address label is too long." }, { status: 400 }); data.label = label }
    if (body.text !== undefined) {
      const text = String(body.text).trim()
      if (text.length < 5 || text.length > 500) return NextResponse.json({ error: "Enter a valid delivery address." }, { status: 400 })
      data.text = text
    }
    if (body.area !== undefined) data.area = body.area ? String(body.area).trim().slice(0, 120) : null
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim().slice(0, 500) : null
    if (body.isDefault !== undefined) data.isDefault = body.isDefault
    const latitude = body.latitude === undefined ? addr.latitude : body.latitude === null ? null : Number(body.latitude)
    const longitude = body.longitude === undefined ? addr.longitude : body.longitude === null ? null : Number(body.longitude)
    if ((latitude == null) !== (longitude == null) || latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) || longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return NextResponse.json({ error: "Enter a valid latitude and longitude together." }, { status: 400 })
    if (body.latitude !== undefined) data.latitude = latitude
    if (body.longitude !== undefined) data.longitude = longitude

    const updated = await db.$transaction(async (tx) => {
      if (body.isDefault === true) await tx.address.updateMany({ where: { userId: session.userId!, id: { not: id } }, data: { isDefault: false } })
      return tx.address.update({ where: { id }, data })
    })
    return NextResponse.json(toAddressDTO(updated))
  } catch {
    return NextResponse.json({ error: "Could not update the address." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const { id } = await params
  const addr = await db.address.findFirst({ where: { id, userId: session.userId! } })
  if (!addr) return NextResponse.json({ error: "Address not found." }, { status: 404 })
  await db.address.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
