import { NextResponse } from "next/server"
import { requireCustomer } from "@/lib/session"
import { loyaltySummary } from "@/lib/loyalty"
import { LOYALTY } from "@/lib/constants"

// GET /api/orders/loyalty — Sphere Points summary for the signed-in customer
export async function GET() {
  const { session, error } = await requireCustomer()
  if (error) return error
  const summary = await loyaltySummary(session!.userId!)
  return NextResponse.json({ ...summary, rules: LOYALTY })
}
