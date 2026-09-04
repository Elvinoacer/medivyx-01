import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPrescriptionDTOFull } from "@/lib/dto"
import { audit, notifyCustomer } from "@/lib/notify"
import { getSession, requireStaff } from "@/lib/session"
import { RX_STATUSES, type RxStatus, type OrderStatus } from "@/lib/constants"
import { getPresignedDownloadUrl } from "@/lib/r2"

type Params = { params: Promise<{ id: string }> }

const RX_INCLUDE = {
  user: { select: { name: true, phone: true } },
  order: { select: { reference: true } },
  reviewedBy: { select: { name: true } },
} as const

// GET — owner customer or staff; includes fileData (restricted access per FR-5.6)
export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to view this prescription." }, { status: 401 })

  const rx = await db.prescription.findUnique({ where: { id }, include: RX_INCLUDE })
  if (!rx || rx.deletedAt) return NextResponse.json({ error: "Prescription not found." }, { status: 404 })

  const isOwner = session.userId && rx.userId === session.userId
  const isStaff = session.staffRole === "ADMIN" || session.staffRole === "PHARMACIST"
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "You do not have access to this prescription." }, { status: 403 })
  }

  const download = new URL(request.url).searchParams.get("download") === "1"
  let presignedUrl: string | null = null
  if (rx.storageKey) {
    try {
      presignedUrl = await getPresignedDownloadUrl(rx.storageKey, 300, download ? rx.fileName : undefined)
    } catch {
      return NextResponse.json({ error: "The prescription file is temporarily unavailable." }, { status: 503 })
    }
  }

  await db.prescriptionAccessLog.create({ data: { prescriptionId: rx.id, actorId: session.userId || session.staffId!, actorRole: session.staffRole || "CUSTOMER", action: download ? "DOWNLOAD" : "VIEW" } })
  if (download && presignedUrl) return NextResponse.redirect(presignedUrl)

  const dto = toPrescriptionDTOFull(rx, true)
  return NextResponse.json({
    ...dto,
    fileData: "",
    fileUrl: presignedUrl,
    storageKey: undefined,
  })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to delete this prescription." }, { status: 401 })
  const rx = await db.prescription.findUnique({ where: { id } })
  if (!rx || rx.deletedAt) return NextResponse.json({ error: "Prescription not found." }, { status: 404 })
  const allowed = rx.userId === session.userId || session.staffRole === "ADMIN"
  if (!allowed) return NextResponse.json({ error: "You do not have permission to delete this prescription." }, { status: 403 })
  if (rx.orderId && session.staffRole !== "ADMIN") return NextResponse.json({ error: "Contact the pharmacy to delete a prescription linked to an order." }, { status: 409 })
  await db.prescription.update({ where: { id }, data: { deletedAt: new Date() } })
  return NextResponse.json({ ok: true })
}

// PATCH — pharmacist review (APPROVED / REJECTED / CLARIFICATION_REQUESTED / PARTIALLY_APPROVED)
export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireStaff(["PHARMACIST", "ADMIN"])
  if (error) return error
  const { id } = await params
  const rx = await db.prescription.findUnique({ where: { id }, include: RX_INCLUDE })
  if (!rx) return NextResponse.json({ error: "Prescription not found." }, { status: 404 })

  try {
    const body = await request.json()
    const status = String(body.status ?? "") as RxStatus
    if (!RX_STATUSES.includes(status)) return NextResponse.json({ error: "Unknown prescription status." }, { status: 400 })
    if (status !== "APPROVED" && status !== "PARTIALLY_APPROVED" && !body.reviewNotes) {
      return NextResponse.json({ error: "A note/reason is required for this decision." }, { status: 400 })
    }

    const reviewNotes = body.reviewNotes ? String(body.reviewNotes).trim().slice(0, 2000) : null
    const refillsAllowed = Math.max(0, Math.min(6, Math.trunc(Number(body.refillsAllowed ?? 0)) || 0))
    const validDays = [30, 60, 90, 180].includes(Number(body.validDays)) ? Number(body.validDays) : 90
    const actor = session.staffName ?? "Pharmacist"

    let linkedOrderUpdate: { reference: string; next: OrderStatus; note: string } | null = null
    await db.$transaction(async (tx) => {
      await tx.prescription.update({
        where: { id }, data: {
        status,
        reviewNotes,
        reviewedById: session.staffId,
        reviewedAt: new Date(),
        refillsAllowed: status === "APPROVED" || status === "PARTIALLY_APPROVED" ? refillsAllowed : 0,
        validUntil: status === "APPROVED" || status === "PARTIALLY_APPROVED" ? new Date(Date.now() + validDays * 24 * 3600 * 1000) : null,
        },
      })

      if (rx.orderId) {
        const order = await tx.order.findUnique({ where: { id: rx.orderId }, select: { id: true, reference: true, status: true } })
        const all = await tx.prescription.findMany({ where: { orderId: rx.orderId, deletedAt: null }, select: { status: true } })
        const allApproved = all.length > 0 && all.every((item) => ["APPROVED", "PARTIALLY_APPROVED"].includes(item.status))
        const allDecided = all.length > 0 && all.every((item) => ["APPROVED", "PARTIALLY_APPROVED", "REJECTED"].includes(item.status))
        const anyRejected = all.some((item) => item.status === "REJECTED")
        const next: OrderStatus = allApproved ? "PRESCRIPTION_VERIFIED" : allDecided && anyRejected ? "REJECTED" : "UNDER_REVIEW"
        if (order && order.status === "UNDER_REVIEW" && next !== order.status) {
          const note = next === "PRESCRIPTION_VERIFIED" ? "All prescriptions verified by a pharmacist" : "Prescription set rejected after all documents were reviewed"
          await tx.order.update({ where: { id: order.id }, data: { status: next, version: { increment: 1 } } })
          await tx.orderStatusHistory.create({ data: { orderId: order.id, status: next, actor, note } })
          linkedOrderUpdate = { reference: order.reference, next, note }
        }
      }
    })

    if (linkedOrderUpdate) {
      const update = linkedOrderUpdate as { reference: string; next: OrderStatus; note: string }
      await notifyCustomer(rx.userId, "PRESCRIPTION", `Prescription update — order ${update.reference}`, update.note, "IN_APP")
    }

    if (rx.userId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
      const customerUser = await db.user.findUnique({ where: { id: rx.userId }, select: { name: true, email: true } })
      const { prescriptionStatusTemplate } = await import("@/lib/email/templates")

      const emailData = prescriptionStatusTemplate({
        customerName: customerUser?.name,
        status: status as "APPROVED" | "REJECTED" | "CLARIFICATION_REQUESTED" | "PARTIALLY_APPROVED",
        reviewNotes: reviewNotes ?? null,
        refillsAllowed: refillsAllowed > 0 ? refillsAllowed : undefined,
        actionUrl: rx.orderId ? `${appUrl}/orders/${rx.orderId}` : `${appUrl}/prescriptions`,
      })

      const noteText =
        status === "APPROVED" ? "Your prescription has been verified and approved by our pharmacist."
        : status === "PARTIALLY_APPROVED" ? `Partially approved: ${reviewNotes ?? ""}`
        : status === "REJECTED" ? `Prescription could not be verified: ${reviewNotes ?? ""}`
        : `Clarification needed: ${reviewNotes ?? ""}`

      await notifyCustomer(
        rx.userId,
        "PRESCRIPTION",
        `Prescription ${status.replace(/_/g, " ").toLowerCase()}`,
        noteText,
        "IN_APP",
        {
          link: rx.orderId ? `${appUrl}/orders/${rx.orderId}` : `${appUrl}/prescriptions`,
          metadata: { prescriptionId: rx.id, status, reviewNotes },
          email: customerUser?.email
            ? {
                to: customerUser.email,
                subject: emailData.subject,
                html: emailData.html,
                text: emailData.text,
              }
            : undefined,
        }
      )
    }

    await audit(actor, session.staffRole, `RX_${status}`, "Prescription", rx.id, `${rx.fileName}${reviewNotes ? ` — ${reviewNotes}` : ""}`)

    const updated = await db.prescription.findUnique({ where: { id }, include: RX_INCLUDE })
    return NextResponse.json(toPrescriptionDTOFull(updated!, true))
  } catch {
    return NextResponse.json({ error: "Could not save the review." }, { status: 500 })
  }
}
