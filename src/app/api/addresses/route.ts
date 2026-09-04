import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toAddressDTO } from "@/lib/dto"
import { requireCustomer } from "@/lib/session"
import { rejectOversizedRequest } from "@/lib/security/request"

export async function GET() {
  const { session, error } = await requireCustomer()
  if (error) return error
  const rows = await db.address.findMany({ where: { userId: session.userId! }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }], take: 50 })
  return NextResponse.json(rows.map(toAddressDTO))
}

export async function POST(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const oversized = rejectOversizedRequest(request, 16_384)
  if (oversized) return oversized
  try {
    const body = await request.json()
    const label = String(body.label ?? "").trim() || "Home"
    const text = String(body.text ?? "").trim()
    if (label.length > 80 || text.length < 5 || text.length > 500) return NextResponse.json({ error: "Enter a valid label and delivery address." }, { status: 400 })

    if (body.isDefault !== undefined && typeof body.isDefault !== "boolean") return NextResponse.json({ error: "isDefault must be true or false." }, { status: 400 })
    const isDefault = body.isDefault === true
    const latitude = body.latitude == null ? null : Number(body.latitude)
    const longitude = body.longitude == null ? null : Number(body.longitude)
    if ((latitude == null) !== (longitude == null) || latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) || longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) return NextResponse.json({ error: "Enter a valid latitude and longitude together." }, { status: 400 })
    const addr = await db.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId: session.userId! }, data: { isDefault: false } })
      return tx.address.create({
      data: {
        userId: session.userId!,
        label,
        text,
        area: body.area ? String(body.area).trim().slice(0, 120) : null,
        notes: body.notes ? String(body.notes).trim().slice(0, 500) : null,
        isDefault,
        latitude, longitude,
      },
      })
    })
    return NextResponse.json(toAddressDTO(addr))
  } catch {
    return NextResponse.json({ error: "Could not save the address." }, { status: 500 })
  }
}
