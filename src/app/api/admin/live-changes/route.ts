import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireStaff } from "@/lib/session"

/**
 * Cheap change cursors for the staff workspace. This is deliberately
 * metadata-only: no customer information, prescriptions, or order contents.
 * Clients fetch the relevant authorized list only when a cursor changes.
 */
export async function GET() {
  const { error } = await requireStaff(["ADMIN", "PHARMACIST", "STAFF"])
  if (error) return error

  try {
    const [latestOrderChange, latestOrderArrival, latestBookingChange, latestBookingArrival] = await Promise.all([
      db.order.findFirst({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { id: true, updatedAt: true } }),
      db.order.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, createdAt: true } }),
      db.serviceBooking.findFirst({ orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { id: true, updatedAt: true } }),
      db.serviceBooking.findFirst({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, createdAt: true } }),
    ])
    const cursor = (row: { id: string; updatedAt?: Date; createdAt?: Date } | null) =>
      row ? `${row.id}:${(row.updatedAt ?? row.createdAt)!.toISOString()}` : null
    return NextResponse.json({
      orders: { change: cursor(latestOrderChange), arrival: cursor(latestOrderArrival),
        arrivedAt: latestOrderArrival?.createdAt.toISOString() ?? null },
      bookings: { change: cursor(latestBookingChange), arrival: cursor(latestBookingArrival),
        arrivedAt: latestBookingArrival?.createdAt.toISOString() ?? null },
    }, { headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } })
  } catch {
    return NextResponse.json({ error: "Could not check for new work." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    })
  }
}
