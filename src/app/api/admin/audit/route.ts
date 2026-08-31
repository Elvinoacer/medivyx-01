import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toAuditLogDTO } from "@/lib/dto"
import { requireStaff } from "@/lib/session"

export async function GET() {
  const { error } = await requireStaff()
  if (error) return error
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 })
  return NextResponse.json(logs.map(toAuditLogDTO))
}
