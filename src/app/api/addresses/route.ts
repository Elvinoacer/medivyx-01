import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toAddressDTO } from "@/lib/dto"
import { requireCustomer } from "@/lib/session"

export async function GET() {
  const { session, error } = await requireCustomer()
  if (error) return error
  const rows = await db.address.findMany({ where: { userId: session.userId! }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] })
  return NextResponse.json(rows.map(toAddressDTO))
}

export async function POST(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  try {
    const body = await request.json()
    const label = String(body.label ?? "").trim() || "Home"
    const text = String(body.text ?? "").trim()
    if (text.length < 5) return NextResponse.json({ error: "Enter the full delivery address." }, { status: 400 })

    const isDefault = Boolean(body.isDefault)
    if (isDefault) {
      await db.address.updateMany({ where: { userId: session.userId! }, data: { isDefault: false } })
    }
    const addr = await db.address.create({
      data: {
        userId: session.userId!,
        label,
        text,
        area: body.area ? String(body.area).trim() : null,
        notes: body.notes ? String(body.notes).trim() : null,
        isDefault,
      },
    })
    return NextResponse.json(toAddressDTO(addr))
  } catch {
    return NextResponse.json({ error: "Could not save the address." }, { status: 500 })
  }
}
