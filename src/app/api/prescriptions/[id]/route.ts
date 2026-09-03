import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPrescriptionDTOFull } from "@/lib/dto"
import { addStatusEvent, audit, notifyCustomer } from "@/lib/notify"
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
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in to view this prescription." }, { status: 401 })

  const rx = await db.prescription.findUnique({ where: { id }, include: RX_INCLUDE })
  if (!rx) return NextResponse.json({ error: "Prescription not found." }, { status: 404 })

  const isOwner = session.userId && rx.userId === session.userId
  const isStaff = Boolean(session.staffId)
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "You do not have access to this prescription." }, { status: 403 })
  }

  let presignedUrl = rx.fileUrl
  if (rx.storageKey) {
    try {
      presignedUrl = await getPresignedDownloadUrl(rx.storageKey, 3600)
    } catch (e) {
      console.warn("[Prescription Presigned URL Error]", e)
    }
  }

  const dto = toPrescriptionDTOFull(rx, true)
  return NextResponse.json({
    ...dto,
    fileData: rx.fileData ?? "",
    fileUrl: presignedUrl ?? rx.fileUrl ?? null,
  })
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

    await db.prescription.update({
      where: { id },
      data: {
        status,
        reviewNotes,
        reviewedById: session.staffId,
        reviewedAt: new Date(),
        refillsAllowed: status === "APPROVED" || status === "PARTIALLY_APPROVED" ? refillsAllowed : 0,
        validUntil: status === "APPROVED" || status === "PARTIALLY_APPROVED" ? new Date(Date.now() + validDays * 24 * 3600 * 1000) : null,
      },
    })

    // linked order transitions (FR-5.7)
    if (rx.orderId) {
      const order = await db.order.findUnique({ where: { id: rx.orderId } })
      if (order && order.status === "UNDER_REVIEW") {
        const next: OrderStatus =
          status === "APPROVED" || status === "PARTIALLY_APPROVED"
            ? "PRESCRIPTION_VERIFIED"
            : status === "REJECTED"
              ? "REJECTED"
              : "UNDER_REVIEW" // clarification keeps it under review
        await db.order.update({ where: { id: order.id }, data: { status: next } })
        const note =
          status === "APPROVED" ? "Prescription verified by pharmacist"
          : status === "PARTIALLY_APPROVED" ? `Partially approved: ${reviewNotes ?? ""}`
          : status === "REJECTED" ? `Prescription rejected: ${reviewNotes ?? ""}`
          : `Clarification requested: ${reviewNotes ?? ""}`
        await addStatusEvent(order.id, next, actor, note.slice(0, 300))
        await notifyCustomer(rx.userId, "PRESCRIPTION", `Prescription update — order ${order.reference}`, note.slice(0, 300), "WHATSAPP")
      }
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
        actionUrl: rx.orderId ? `${appUrl}/#order-${rx.orderId}` : `${appUrl}/#prescriptions`,
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
          link: rx.orderId ? `${appUrl}/#order-${rx.orderId}` : `${appUrl}/#prescriptions`,
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
