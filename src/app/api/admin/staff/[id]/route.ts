import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toStaffDTO } from "@/lib/session"
import { audit } from "@/lib/notify"
import { requireStaff, revokeStaffSessions } from "@/lib/session"
import { hashPassword, validatePassword } from "@/lib/hash"
import { ROLES, type Role } from "@/lib/constants"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN"])
  if (error) return error
  const { id } = await params
  const staff = await db.staffUser.findUnique({ where: { id } })
  if (!staff) return NextResponse.json({ error: "Staff account not found." }, { status: 404 })
  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (name.length < 2) return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 })
      data.name = name
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 })
      const clash = await db.staffUser.findUnique({ where: { email } })
      if (clash && clash.id !== id) return NextResponse.json({ error: "This email is in use by another staff account." }, { status: 409 })
      data.email = email
    }
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null
    if (body.title !== undefined) data.title = body.title ? String(body.title).trim() : null
    if (body.role !== undefined) {
      const role = String(body.role) as Role
      if (!ROLES.includes(role)) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 })
      data.role = role
      data.authVersion = { increment: 1 }
    }
    if (body.active !== undefined) {
      if (id === session.staffId && body.active === false) {
        return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 })
      }
      if (typeof body.active !== "boolean") return NextResponse.json({ error: "Active must be a boolean." }, { status: 400 })
      data.active = body.active
      data.authVersion = { increment: 1 }
    }
    if (body.password) {
      const passwordError = validatePassword(String(body.password))
      if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 })
      data.passwordHash = await hashPassword(String(body.password))
      data.authVersion = { increment: 1 }
    }

    const updated = await db.staffUser.update({ where: { id }, data })
    if (body.role !== undefined || body.active !== undefined || body.password) await revokeStaffSessions(id)
    await audit(session.staffName ?? "Admin", "ADMIN", "STAFF_UPDATED", "StaffUser", id, `${updated.name} (${updated.role})`)
    return NextResponse.json(toStaffDTO(updated))
  } catch {
    return NextResponse.json({ error: "Could not update the staff account." }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["ADMIN"])
  if (error) return error
  const { id } = await params
  if (id === session.staffId) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 })
  }
  const staff = await db.staffUser.findUnique({ where: { id } })
  if (!staff) return NextResponse.json({ error: "Staff account not found." }, { status: 404 })
  try {
    const hasSessions = await db.session.count({ where: { staffId: id } })
    if (hasSessions > 0) {
      // soft-delete: deactivate instead
      await db.staffUser.update({ where: { id }, data: { active: false } })
      await db.session.deleteMany({ where: { staffId: id } })
      await audit(session.staffName ?? "Admin", "ADMIN", "STAFF_DEACTIVATED", "StaffUser", id, `${staff.name}`)
      return NextResponse.json({ ok: true, deactivated: true })
    }
    await db.staffUser.delete({ where: { id } })
    await audit(session.staffName ?? "Admin", "ADMIN", "STAFF_DELETED", "StaffUser", id, `${staff.name}`)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Could not remove the staff account." }, { status: 500 })
  }
}
