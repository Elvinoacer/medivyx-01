import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toAddressDTO } from "@/lib/dto"
import { requireCustomer } from "@/lib/session"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireCustomer()
  if (error) return error
  const { id } = await params
  const addr = await db.address.findFirst({ where: { id, userId: session.userId! } })
  if (!addr) return NextResponse.json({ error: "Address not found." }, { status: 404 })
  try {
    const body = await request.json()
    if (body.isDefault) {
      await db.address.updateMany({ where: { userId: session.userId! }, data: { isDefault: false } })
    }
    const data: Record<string, unknown> = {}
    if (body.label !== undefined) data.label = String(body.label).trim() || "Home"
    if (body.text !== undefined) {
      const text = String(body.text).trim()
      if (text.length < 5) return NextResponse.json({ error: "Enter the full delivery address." }, { status: 400 })
      data.text = text
    }
    if (body.area !== undefined) data.area = body.area ? String(body.area).trim() : null
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null
    if (body.isDefault !== undefined) data.isDefault = Boolean(body.isDefault)

    const updated = await db.address.update({ where: { id }, data })
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
