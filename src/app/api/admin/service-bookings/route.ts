import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
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

// Service bookings use Nairobi calendar days, regardless of the server's time zone.
function nairobiDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value || ""
  return [part("year"), part("month"), part("day")].join("-")
}

function dayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const check = new Date(date + "T12:00:00Z")
  if (Number.isNaN(check.getTime()) || check.toISOString().slice(0, 10) !== date) return null
  const start = new Date(date + "T00:00:00+03:00")
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) }
}

const activeBookingStatuses = ["PENDING", "CONFIRMED", "RESCHEDULED", "ARRIVED", "IN_PROGRESS"]

// An indexed, paginated administrative view. Do not fetch the entire booking history
// or full user/status-history relations just to render one page of the work queue.
const bookingStatusValues = ["PENDING", "CONFIRMED", "RESCHEDULED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED"] as const
const terminalStatuses = ["COMPLETED", "CANCELLED", "NO_SHOW", "REJECTED"]
const selectedBookingRelations = {
  service: { select: { name: true } },
  user: { select: { name: true, phone: true, email: true } },
} as const

function manageDto(b: any, statusHistory: any[] = []) {
  return {
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
    price: b.price == null ? null : Number(b.price),
    paymentStatus: b.paymentStatus,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    statusHistory: statusHistory.map((h: any) => ({
      id: h.id, status: h.status, note: h.note,
      actor: h.actor, createdAt: h.createdAt.toISOString(),
    })),
  }
}

async function manageBookings(url: URL) {
  const params = url.searchParams
  const view = params.get("view") || "queue"
  if (!["queue", "upcoming", "history", "all"].includes(view))
    return NextResponse.json({ error: "Invalid bookings view." }, { status: 400 })

  const page = Math.min(100000, Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1))
  const pageSize = Math.min(50, Math.max(5, Number.parseInt(params.get("pageSize") || "20", 10) || 20))
  const status = params.get("status") || "all"
  if (status !== "all" && !(bookingStatusValues as readonly string[]).includes(status))
    return NextResponse.json({ error: "Invalid status filter." }, { status: 400 })
  const range = params.get("range") || "any"
  if (!["any", "today", "next7", "custom"].includes(range))
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 })

  const today = dayBounds(nairobiDate(new Date()))!
  const filters: Prisma.ServiceBookingWhereInput[] = []
  if (view === "queue") filters.push({ status: "PENDING" })
  if (view === "upcoming") filters.push({
    status: { in: activeBookingStatuses },
    scheduledStart: { gte: today.start },
  })
  if (view === "history") filters.push({ status: { in: terminalStatuses } })
  if (status !== "all") filters.push({ status })

  if (range === "today") {
    filters.push({ scheduledStart: { gte: today.start, lt: today.end } })
  } else if (range === "next7") {
    filters.push({ scheduledStart: {
      gte: today.start,
      lt: new Date(today.start.getTime() + 7 * 86400000),
    } })
  } else if (range === "custom") {
    const from = params.get("from")
    const to = params.get("to")
    const begin = from ? dayBounds(from) : null
    const finish = to ? dayBounds(to) : null
    if (!begin || !finish || begin.start > finish.start || finish.start.getTime() - begin.start.getTime() > 366 * 86400000)
      return NextResponse.json({ error: "Choose a valid date range of up to one year." }, { status: 400 })
    filters.push({ scheduledStart: { gte: begin.start, lt: finish.end } })
  }

  const staffId = params.get("staffId")
  if (staffId && staffId !== "all") {
    if (staffId.length > 100) return NextResponse.json({ error: "Invalid staff filter." }, { status: 400 })
    filters.push({ assignedStaffId: staffId === "unassigned" ? null : staffId })
  }
  const query = (params.get("q") || "").trim().slice(0, 120)
  if (query) {
    filters.push({
      OR: [
        { reference: { contains: query, mode: "insensitive" } },
        { service: { is: { name: { contains: query, mode: "insensitive" } } } },
        { user: { is: { name: { contains: query, mode: "insensitive" } } } },
        { user: { is: { phone: { contains: query, mode: "insensitive" } } } },
        { user: { is: { email: { contains: query, mode: "insensitive" } } } },
      ],
    })
  }
  const where: Prisma.ServiceBookingWhereInput = { AND: filters }
  const orderBy: Prisma.ServiceBookingOrderByWithRelationInput[] = view === "history" || view === "all"
    ? [{ scheduledStart: "desc" }, { id: "desc" }]
    : [{ scheduledStart: "asc" }, { id: "asc" }]

  const [total, rows] = await Promise.all([
    db.serviceBooking.count({ where }),
    db.serviceBooking.findMany({
      where,
      include: selectedBookingRelations,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])
  return NextResponse.json({
    items: rows.map((b) => manageDto(b)),
    total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }, { headers: { "Cache-Control": "no-store" } })
}

async function bookingDetail(id: string) {
  if (!id || id.length > 100) return NextResponse.json({ error: "Invalid booking." }, { status: 400 })
  const record = await db.serviceBooking.findUnique({
    where: { id },
    include: {
      ...selectedBookingRelations,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  })
  if (!record) return NextResponse.json({ error: "Booking not found." }, { status: 404 })
  return NextResponse.json(manageDto(record, record.statusHistory), { headers: { "Cache-Control": "no-store" } })
}


export async function GET(request: Request) {
  const session = await getSession()
  if (!can(session)) return NextResponse.json({ error: "Staff access required." }, { status: 403 })

  const url = new URL(request.url)
  const date = url.searchParams.get("date")
  const bounds = date ? dayBounds(date) : null
  if (date && !bounds) return NextResponse.json({ error: "Invalid appointment date." }, { status: 400 })

  if (url.searchParams.get("scope") === "manage") return manageBookings(url)
  if (url.searchParams.get("scope") === "detail") return bookingDetail(url.searchParams.get("id") || "")

  if (url.searchParams.get("scope") === "overview") {
    const today = dayBounds(nairobiDate(new Date()))!
    const selectedDay = bounds || today
    const nextDayStart = new Date(Math.max(selectedDay.end.getTime(), today.start.getTime()))
    const [pendingCount, upcomingCount, pendingPreview, nextBooking, nextBookedDay] = await Promise.all([
      db.serviceBooking.count({ where: { status: "PENDING" } }),
      db.serviceBooking.count({
        where: { scheduledStart: { gte: today.start }, status: { in: activeBookingStatuses } },
      }),
      db.serviceBooking.findMany({
        where: { status: "PENDING" },
        orderBy: { scheduledStart: "asc" },
        take: 4,
        select: {
          id: true, reference: true, scheduledStart: true,
          service: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      db.serviceBooking.findFirst({
        where: { scheduledStart: { gte: today.start }, status: { in: activeBookingStatuses } },
        orderBy: { scheduledStart: "asc" },
        select: { scheduledStart: true, service: { select: { name: true } } },
      }),
      db.serviceBooking.findFirst({
        where: { scheduledStart: { gte: nextDayStart }, status: { in: activeBookingStatuses } },
        orderBy: { scheduledStart: "asc" },
        select: { scheduledStart: true },
      }),
    ])

    return NextResponse.json({
      pendingCount,
      upcomingCount,
      pendingPreview: pendingPreview.map((booking) => ({
        id: booking.id,
        reference: booking.reference,
        scheduledStart: booking.scheduledStart.toISOString(),
        serviceName: booking.service.name,
        customerName: booking.user.name,
      })),
      nextBooking: nextBooking ? {
        scheduledStart: nextBooking.scheduledStart.toISOString(),
        serviceName: nextBooking.service.name,
      } : null,
      nextBookedDate: nextBookedDay ? nairobiDate(nextBookedDay.scheduledStart) : null,
    }, { headers: { "Cache-Control": "no-store" } })
  }

  const where = bounds ? { scheduledStart: { gte: bounds.start, lt: bounds.end } } : {}

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
    COMPLETED: "Your care service has been completed. Thank you for choosing Medivyx.",
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
      link: `${process.env.NEXT_PUBLIC_APP_URL || "https://medivyx.co.ke"}/#admin`,
      metadata: { bookingId: booking.id, status },
    })
  }

  return NextResponse.json({ ok: true, status: updated.status })
}
