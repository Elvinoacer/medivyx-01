import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { toPrescriptionDTOFull } from "@/lib/dto"
import { addStatusEvent, notifyCustomer } from "@/lib/notify"
import { requireCustomer, requireStaff } from "@/lib/session"
import { uploadBase64ToR2 } from "@/lib/r2"

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "application/pdf"]

// GET /api/orders            → customer's own prescriptions
// GET /api/orders?scope=queue → staff: review queue
export async function GET(request: Request) {
  const url = new URL(request.url)
  const scope = url.searchParams.get("scope")

  if (scope === "queue") {
    const { error } = await requireStaff(["PHARMACIST", "ADMIN", "STAFF"])
    if (error) return error
    const rows = await db.prescription.findMany({
      include: { user: { select: { name: true, phone: true } }, order: { select: { reference: true } }, reviewedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    const order = { PENDING: 0, CLARIFICATION_REQUESTED: 1, PARTIALLY_APPROVED: 2, APPROVED: 3, REJECTED: 4 }
    const sorted = rows.sort((a, b) => (order[a.status as keyof typeof order] ?? 9) - (order[b.status as keyof typeof order] ?? 9))
    return NextResponse.json(sorted.map((rx) => toPrescriptionDTOFull(rx, true)))
  }

  const { session, error } = await requireCustomer()
  if (error) return error
  const rows = await db.prescription.findMany({
    where: { userId: session.userId },
    include: { user: { select: { name: true, phone: true } }, order: { select: { reference: true } }, reviewedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(rows.map((rx) => toPrescriptionDTOFull(rx, true)))
}

// POST — customer uploads a prescription
export async function POST(request: Request) {
  const { session, error } = await requireCustomer()
  if (error) return error
  try {
    const body = await request.json()
    const fileName = String(body.fileName ?? "").trim()
    const fileType = String(body.fileType ?? "").trim().toLowerCase()
    let fileData = typeof body.fileData === "string" ? body.fileData : ""
    let fileUrl: string | null = body.fileUrl ? String(body.fileUrl) : null
    let storageKey: string | null = body.storageKey ? String(body.storageKey) : null

    if (!fileName) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 })
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json({ error: "Upload an image (PNG/JPEG/WebP/HEIC) or a PDF." }, { status: 400 })
    }

    // The frontend may upload the binary to R2 first and then send only
    // fileUrl/storageKey. In that case there is no base64 payload to validate.
    const hasRemoteUpload = Boolean(fileUrl && storageKey)
    if (hasRemoteUpload) {
      const expectedPrefix = `prescriptions/${session.userId}/`
      if (!storageKey!.startsWith(expectedPrefix)) {
        return NextResponse.json({ error: "Invalid prescription storage reference." }, { status: 400 })
      }
      fileData = ""
    } else {
      // Accept both raw base64 and data URLs for the database/R2 fallback path.
      const dataUrlMatch = /^data:[^;]+;base64,([\s\S]*)$/.exec(fileData)
      if (dataUrlMatch) fileData = dataUrlMatch[1]
      fileData = fileData.replace(/\s/g, "")

      if (!fileData || !/^[A-Za-z0-9+/]*={0,2}$/.test(fileData) || fileData.length < 32 || fileData.length % 4 !== 0) {
        return NextResponse.json({ error: "The file appears to be corrupt. Try re-uploading." }, { status: 400 })
      }

      const decodedBytes = Math.floor((fileData.length * 3) / 4) - (fileData.endsWith("==") ? 2 : fileData.endsWith("=") ? 1 : 0)
      if (decodedBytes > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File is too large — 10MB maximum." }, { status: 400 })
      }
    }

    const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null

    // optional: attach to one of the customer's own orders
    let orderId: string | null = null
    if (body.orderId) {
      const order = await db.order.findFirst({ where: { id: String(body.orderId), userId: session.userId } })
      if (order) orderId = order.id
    }

    // If base64 was supplied, upload it to R2 here. If the client already uploaded
    // directly to R2, preserve the supplied fileUrl/storageKey instead.
    if (fileData) {
      try {
        const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : ""
        const cleanName = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40)
        const userFolder = session.userId || "guest"
        const key = `prescriptions/${userFolder}/${Date.now()}_${cleanName}${ext}`
        const r2Res = await uploadBase64ToR2(fileData, key, fileType, {
          userId: session.userId || "anonymous",
          fileName,
        })
        fileUrl = r2Res.url
        storageKey = r2Res.key
      } catch (err) {
        console.warn("[R2 Prescription Upload Warning] Falling back to database base64 storage:", err)
      }
    }

    if (!fileData && !fileUrl && !storageKey) {
      return NextResponse.json({ error: "The prescription file could not be stored. Please try again." }, { status: 400 })
    }

    const rx = await db.prescription.create({
      data: {
        userId: session.userId,
        orderId,
        fileName,
        fileType,
        fileData: fileData || null,
        fileUrl,
        storageKey,
        notes,
      },
      include: { user: { select: { name: true, phone: true } }, order: { select: { reference: true } }, reviewedBy: { select: { name: true } } },
    })

    if (orderId) {
      await addStatusEvent(orderId, "UNDER_REVIEW", "System", "Prescription uploaded — queued for pharmacist review")
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"
    const customerUser = await db.user.findUnique({ where: { id: session.userId! }, select: { name: true, email: true } })
    const customerName = customerUser?.name || "Customer"

    await notifyCustomer(
      session.userId,
      "PRESCRIPTION",
      "Prescription received",
      "We received your prescription. Our pharmacist is reviewing it — usually within 2 working hours.",
      "IN_APP",
      {
        link: `${appUrl}/#prescriptions`,
        metadata: { prescriptionId: rx.id, orderId },
        email: customerUser?.email
          ? {
              to: customerUser.email,
              subject: "Prescription Received — Sphere Pharmacy",
              html: `<p>Hello ${customerName},</p><p>We have safely received your uploaded prescription (<strong>${fileName}</strong>). Our licensed pharmacist will review it shortly (usually within 2 working hours).</p><p>You will receive another update once verification is complete.</p>`,
              text: `Hello ${customerName},\nWe received your prescription (${fileName}). Our pharmacist will review it shortly.`,
            }
          : undefined,
      }
    )

    // Alert pharmacists and admins
    const { notifyStaff } = await import("@/lib/notify")
    await notifyStaff({
      roles: ["PHARMACIST", "ADMIN"],
      event: "NEW_PRESCRIPTION",
      title: "New Prescription Uploaded",
      message: `Prescription uploaded by ${customerName} awaiting pharmacist review.`,
      link: `${appUrl}/#admin-prescriptions`,
      details: {
        Customer: customerName,
        File: fileName,
        LinkedOrder: rx.order?.reference || "None",
      },
    })
    return NextResponse.json(toPrescriptionDTOFull(rx, true))
  } catch {
    return NextResponse.json({ error: "Could not upload the prescription. Please try again." }, { status: 500 })
  }
}
