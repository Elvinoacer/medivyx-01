import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { notifyServiceBooking, notifyStaff } from "@/lib/notify"

function can(session: any) {
  return Boolean(session?.staffId && ["ADMIN", "PHARMACIST", "STAFF"].includes(session.staffRole))
}

function localMinutes(value: string) {
  const [h, m] = value.split(":").map(Number)
  return h * 60 + m
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!can(session)) return NextResponse.json({ error: "Staff access required." }, { status: 403 })

  const url = new URL(request.url)
  const date = url.searchParams.get("date")
  const where: any = {}

  if (date) {
    const start = new Date(date + "T00:00:00")
    const end = new Date(date + "T23:59:59.999")
    if (!Number.isNaN(start.getTime())) {
      where.scheduledStart = { gte: start, lte: end }
    }
  }

  const list = await db.serviceBooking.findMany({
    where,
    include: {
      service: true,
      user: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { scheduledStart: "asc" },
  })

  return NextResponse.json(
    list.map((b: any) => ({
      id: b.id,
      reference: b.reference,
      serviceId: b.serviceId,
      serviceName: b.service.name,
      userId: b.userId,
      customerName: b.user?.name || null,
      customerPhone: b.user?.phone || null,
      customerEmail: b.user?.email || null,
      scheduledStart: b.scheduledStart.toISOString(),
      scheduledEnd: b.scheduledEnd.toISOString(),
      status: b.status,
      assignedStaffId: b.assignedStaffId,
      customerNotes: b.customerNotes,
      staffNotes: b.staffNotes,
      price: b.price,
      paymentStatus: b.paymentStatus,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      statusHistory: b.statusHistory.map((h: any) => ({ ...h, createdAt: h.createdAt.toISOString() })),
    })),
  )
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!can(session)) return NextResponse.json({ error: "Staff access required." }, { status: 403 })

  const body = await request.json()
  const id = String(body.id || "")
  const status = String(body.status || "")

  const allowed = ["PENDING", "CONFIRMED", "RESCHEDULED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED"]
  if (!allowed.includes(status)) return NextResponse.json({ error: "Invalid booking status." }, { status: 400 })

  const booking = await db.serviceBooking.findUnique({
    where: { id },
    include: {
      service: {
        include: {
          availability: { where: { enabled: true } },
        },
      },
    },
  })

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 })

  if (body.scheduledStart || body.scheduledEnd) {
    const nextStart = body.scheduledStart ? new Date(String(body.scheduledStart)) : booking.scheduledStart
    const nextEnd = body.scheduledEnd ? new Date(String(body.scheduledEnd)) : booking.scheduledEnd

    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextEnd <= nextStart) {
      return NextResponse.json({ error: "Invalid reschedule time." }, { status: 400 })
    }
    if (nextStart < new Date()) {
      return NextResponse.json({ error: "Rescheduled time must be in the future." }, { status: 400 })
    }
    if (nextEnd.getTime() - nextStart.getTime() !== booking.service.durationMinutes * 60000) {
      return NextResponse.json({ error: "Rescheduled duration must match the service." }, { status: 400 })
    }

    const formatter = new Intl.DateTimeFormat("en-KE", {
      timeZone: "Africa/Nairobi",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
    const startParts = formatter.formatToParts(nextStart)
    const endParts = formatter.formatToParts(nextEnd)
    const value = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find((p) => p.type === type)?.value || ""
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const day = dayNames.indexOf(value(startParts, "weekday"))
    const endDay = dayNames.indexOf(value(endParts, "weekday"))
    const startMinutes = Number(value(startParts, "hour")) * 60 + Number(value(startParts, "minute"))
    const endMinutes = Number(value(endParts, "hour")) * 60 + Number(value(endParts, "minute"))

    const allowedByHours = booking.service.availability.some((rule: any) => {
      return (
        rule.dayOfWeek === day &&
        day === endDay &&
        startMinutes >= localMinutes(rule.startTime) &&
        endMinutes <= localMinutes(rule.endTime)
      )
    })

    if (!allowedByHours) {
      return NextResponse.json({ error: "That time is outside the service availability." }, { status: 409 })
    }

    const conflict = await db.serviceBooking.findFirst({
      where: {
        id: { not: id },
        serviceId: booking.serviceId,
        status: { notIn: ["CANCELLED", "REJECTED", "NO_SHOW"] },
        scheduledStart: { lt: nextEnd },
        scheduledEnd: { gt: nextStart },
      },
    })

    if (conflict) return NextResponse.json({ error: "That time overlaps another booking." }, { status: 409 })

    if (!["PENDING", "CONFIRMED", "RESCHEDULED"].includes(booking.status)) {
      return NextResponse.json({ error: "Only pending or confirmed appointments can be rescheduled." }, { status: 409 })
    }

    await db.serviceBooking.update({
      where: { id },
      data: { scheduledStart: nextStart, scheduledEnd: nextEnd, status: "RESCHEDULED" },
    })

    await db.serviceBookingStatusHistory.create({
      data: {
        bookingId: id,
        status: "RESCHEDULED",
        note: "Appointment rescheduled by staff.",
        actor: session!.staffId!,
      },
    })

    const customer = await db.user.findUnique({
      where: { id: booking.userId },
      select: { name: true, email: true },
    })

    await notifyServiceBooking({
      userId: booking.userId,
      customerName: customer?.name,
      customerEmail: customer?.email,
      reference: booking.reference,
      serviceName: booking.service.name,
      status: "Booking rescheduled",
      message:
        "Your " +
        booking.service.name +
        " appointment has been moved to " +
        nextStart.toLocaleString("en-KE", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Africa/Nairobi",
        }) +
        ".",
      start: nextStart,
      end: nextEnd,
      bookingId: booking.id,
      event: "SERVICE_BOOKING_RESCHEDULED",
    })

    return NextResponse.json({ ok: true, status: "RESCHEDULED" })
  }

  const transitions: Record<string, string[]> = {
    PENDING: ["CONFIRMED", "CANCELLED", "REJECTED", "RESCHEDULED"],
    CONFIRMED: ["ARRIVED", "CANCELLED", "RESCHEDULED"],
    ARRIVED: ["IN_PROGRESS", "NO_SHOW"],
    IN_PROGRESS: ["COMPLETED"],
    RESCHEDULED: ["CONFIRMED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
    REJECTED: [],
  }

  if (transitions[booking.status] && !transitions[booking.status].includes(status)) {
    return NextResponse.json({ error: "That status change is not allowed from the current booking state." }, { status: 409 })
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.serviceBooking.update({
      where: { id },
      data: {
        status,
        staffNotes: body.staffNotes !== undefined ? String(body.staffNotes) : booking.staffNotes,
      },
    })

    await tx.serviceBookingStatusHistory.create({
      data: {
        bookingId: id,
        status,
        note: body.note ? String(body.note) : null,
        actor: session!.staffId!,
      },
    })

    return result
  })

  const customer = await db.user.findUnique({
    where: { id: booking.userId },
    select: { name: true, email: true },
  })
  const service = await db.service.findUnique({
    where: { id: booking.serviceId },
    select: { name: true },
  })

  const labels: Record<string, string> = {
    PENDING: "Booking received",
    CONFIRMED: "Booking confirmed",
    RESCHEDULED: "Booking rescheduled",
    ARRIVED: "You are checked in",
    IN_PROGRESS: "Your service has started",
    COMPLETED: "Service completed",
    CANCELLED: "Booking cancelled",
    NO_SHOW: "Missed appointment",
    REJECTED: "Booking declined",
  }

  const messages: Record<string, string> = {
    CONFIRMED: `Your ${service?.name || "service"} appointment is confirmed. We look forward to seeing you.`,
    RESCHEDULED: `Your ${service?.name || "service"} appointment has been rescheduled.`,
    ARRIVED: "You have been marked as arrived. Our pharmacy team will assist you shortly.",
    IN_PROGRESS: "Your care service is now in progress.",
    COMPLETED: "Your care service has been completed. Thank you for choosing Sphere Pharmacy.",
    CANCELLED: "Your appointment has been cancelled. Please contact the pharmacy if you need assistance.",
    NO_SHOW: "We marked this appointment as a no-show. Contact the pharmacy if you need to rebook.",
    REJECTED: "We could not confirm this appointment. Please contact the pharmacy to arrange another time.",
  }

  await notifyServiceBooking({
    userId: booking.userId,
    customerName: customer?.name,
    customerEmail: customer?.email,
    reference: booking.reference,
    serviceName: service?.name || "Care service",
    status: labels[status] || status,
    message: messages[status] || `Your appointment status is now ${labels[status] || status}.`,
    start: booking.scheduledStart,
    end: booking.scheduledEnd,
    bookingId: booking.id,
  })

  if (["CANCELLED", "NO_SHOW", "REJECTED"].includes(status)) {
    await notifyStaff({
      roles: ["ADMIN", "PHARMACIST", "STAFF"],
      event: "SERVICE_BOOKING_STATUS",
      title: "Service booking updated",
      message: `${booking.reference} is now ${labels[status] || status}.`,
      link: `${process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"}/#admin`,
      metadata: { bookingId: booking.id, status },
    })
  }

  return NextResponse.json({ ok: true, status: updated.status })
}
