import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff, toStaffDTO } from "@/lib/session"

// Dispatch coordinators need the rider roster even when they are not administrators.
// The general /api/admin/staff endpoint deliberately remains ADMIN-only.
export async function GET() {
  const { error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
  if (error) return error
  const riders = await db.staffUser.findMany({
    where: { role: "RIDER", active: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json(riders.map(toStaffDTO), {
    headers: { "Cache-Control": "private, no-store" },
  })
}
