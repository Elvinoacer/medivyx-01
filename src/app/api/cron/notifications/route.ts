import { NextResponse } from "next/server"
import { authorizedJob, dispatchNotifications } from "@/lib/notifications/delivery"
export const runtime = "nodejs"
export const maxDuration = 300
export async function GET(request: Request) {
  if (!authorizedJob(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await dispatchNotifications(10), { headers: { "Cache-Control": "no-store" } })
}
