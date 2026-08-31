import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toStaffDTO } from "@/lib/session"
import { audit } from "@/lib/notify"
import { requireStaff, createSession } from "@/lib/session"
import { hashPassword } from "@/lib/hash"
import { ROLES, type Role } from "@/lib/constants"

export async function GET() {
  const { error } = await requireStaff()
  if (error) return error
  const staff = await db.staffUser.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json(staff.map(toStaffDTO))
}

export async function POST(request: Request) {
  const { session, error } = await requireStaff(["ADMIN"])
  if (error) return error
  try {
    const body = await request.json()
    const name = String(body.name ?? "").trim()
    const email = String(body.email ?? "").trim().toLowerCase()
    const role = String(body.role ?? "") as Role
    const password = String(body.password ?? "")
    if (name.length < 2) return NextResponse.json({ error: "Enter the staff name." }, { status: 400 })
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 })
    if (!ROLES.includes(role)) return NextResponse.json({ error: "Choose a valid role." }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 })
    const clash = await db.staffUser.findUnique({ where: { email } })
    if (clash) return NextResponse.json({ error: "A staff account with this email exists." }, { status: 409 })

    const staff = await db.staffUser.create({
      data: {
        name, email,
        phone: body.phone ? String(body.phone).trim() : null,
        role,
        title: body.title ? String(body.title).trim() : null,
        passwordHash: hashPassword(password),
      },
    })
    await audit(session.staffName ?? "Admin", "ADMIN", "STAFF_CREATED", "StaffUser", staff.id, `${name} (${role})`)
    return NextResponse.json(toStaffDTO(staff))
  } catch {
    return NextResponse.json({ error: "Could not create the staff account." }, { status: 500 })
  }
}
