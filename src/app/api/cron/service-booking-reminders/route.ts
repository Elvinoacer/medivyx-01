import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyServiceBooking } from "@/lib/notify"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const auth = request.headers.get("authorization")
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const now = new Date()
  const windows = [
    { event: "SERVICE_BOOKING_REMINDER_24H", minHours: 23.5, maxHours: 24.5, text: "Reminder: your Sphere Pharmacy appointment is tomorrow." },
    { event: "SERVICE_BOOKING_REMINDER_2H", minHours: 1.5, maxHours: 2.5, text: "Reminder: your Sphere Pharmacy appointment starts in about 2 hours." },
  ]

  let sent = 0
  for (const window of windows) {
    const from = new Date(now.getTime() + window.minHours * 3600000)
    const to = new Date(now.getTime() + window.maxHours * 3600000)
    const bookings = await db.serviceBooking.findMany({
      where: { scheduledStart: { gte: from, lte: to }, status: { in: ["PENDING", "CONFIRMED"] } },
      include: { service: true, user: true },
    })
    for (const booking of bookings) {
      const duplicate = await db.notification.findFirst({
        where: { userId: booking.userId, event: window.event, metadata: { contains: booking.id } },
        select: { id: true },
      })
      if (duplicate) continue
      await notifyServiceBooking({
        userId: booking.userId,
        customerName: booking.user.name,
        customerEmail: booking.user.email,
        reference: booking.reference,
        serviceName: booking.service.name,
        status: "Appointment reminder",
        message: `${window.text} ${booking.service.name} is scheduled for ${booking.scheduledStart.toLocaleString("en-KE",{weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"})}.`,
        start: booking.scheduledStart,
        end: booking.scheduledEnd,
        bookingId: booking.id,
      })
      await db.notification.create({
        data: { userId: booking.userId, channel: "IN_APP", event: window.event, title: "Appointment reminder", message: window.text, metadata: JSON.stringify({ bookingId: booking.id, reference: booking.reference }) },
      })
      sent++
    }
  }
  return NextResponse.json({ ok: true, sent })
}
