import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { getSession } from "@/lib/session"
import { getPresignedUploadUrl, uploadToR2 } from "@/lib/r2"
import { validateFile } from "@/lib/security/file"
import { enforceRateLimit, publicError, rejectOversizedRequest } from "@/lib/security/request"

const FOLDERS = ["products", "prescriptions", "avatars", "services", "general"] as const
type Folder = (typeof FOLDERS)[number]
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf"])
const MAX_BYTES = 10 * 1024 * 1024

function folderAllowed(folder: Folder, session: Awaited<ReturnType<typeof getSession>>): boolean {
  if (!session) return false
  if (folder === "prescriptions") return Boolean(session.userId)
  if (folder === "avatars") return Boolean(session.userId || session.staffId)
  if (folder === "products" || folder === "services") return session.staffRole === "ADMIN" || session.staffRole === "PHARMACIST"
  return session.staffRole === "ADMIN" || session.staffRole === "STAFF"
}

function parseFolder(value: unknown): Folder | null {
  return typeof value === "string" && FOLDERS.includes(value as Folder) ? value as Folder : null
}

function safeName(value: unknown): string {
  return String(value || "upload").toLowerCase().replace(/[^a-z0-9._-]/g, "_").replace(/_{2,}/g, "_").slice(0, 80)
}

function objectKey(folder: Folder, ownerId: string, fileName: string): string {
  const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : ""
  return `${folder}/${ownerId}/${randomUUID()}${ext}`
}

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, MAX_BYTES * 1.4 + 16_384)
    if (tooLarge) return tooLarge
    const session = await getSession()
    if (!session) return NextResponse.json({ error: "Sign in before uploading files." }, { status: 401 })
    const limited = await enforceRateLimit(request, "upload", 20, 15 * 60 * 1000, session.userId || session.staffId || "")
    if (limited) return limited
    const contentType = request.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      const body = await request.json()
      const folder = parseFolder(body.folder)
      if (!folder) return NextResponse.json({ error: "Unknown upload folder." }, { status: 400 })
      if (!folderAllowed(folder, session)) return NextResponse.json({ error: "You do not have permission to upload here." }, { status: 403 })
      const fileName = safeName(body.fileName)
      const declaredType = String(body.fileType || "").toLowerCase()
      if (!ALLOWED_TYPES.has(declaredType)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
      const ownerId = session.userId || session.staffId!
      const key = objectKey(folder, ownerId, fileName)

      if (body.action === "presign") {
        if (folder !== "prescriptions") return NextResponse.json({ error: "Direct upload is available only for private prescription files." }, { status: 400 })
        const fileSize = Number(body.fileSize)
        if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) return NextResponse.json({ error: "Invalid file size." }, { status: 400 })
        return NextResponse.json(await getPresignedUploadUrl(key, declaredType, fileSize, { ownerid: ownerId, originalname: fileName, category: "prescription" }))
      }

      const raw = typeof body.fileData === "string" ? body.fileData.slice(body.fileData.indexOf(",") + 1).replace(/\s/g, "") : ""
      if (!raw || raw.length > Math.ceil(MAX_BYTES / 3) * 4 + 4) return NextResponse.json({ error: "Missing or oversized file data." }, { status: 413 })
      const buffer = Buffer.from(raw, "base64")
      const invalid = validateFile(buffer, declaredType, fileName, MAX_BYTES)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
      const result = await uploadToR2({ key, body: buffer, contentType: declaredType, access: folder === "prescriptions" ? "private" : "public", metadata: { ownerid: ownerId, originalname: fileName, category: folder } })
      return NextResponse.json(result)
    }

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData()
      const file = form.get("file")
      const folder = parseFolder(form.get("folder"))
      if (!(file instanceof File) || !folder) return NextResponse.json({ error: "A file and valid folder are required." }, { status: 400 })
      if (!folderAllowed(folder, session)) return NextResponse.json({ error: "You do not have permission to upload here." }, { status: 403 })
      const fileName = safeName(file.name)
      const declaredType = file.type.toLowerCase()
      if (!ALLOWED_TYPES.has(declaredType)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
      const buffer = Buffer.from(await file.arrayBuffer())
      const invalid = validateFile(buffer, declaredType, fileName, MAX_BYTES)
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
      const ownerId = session.userId || session.staffId!
      const key = objectKey(folder, ownerId, fileName)
      const result = await uploadToR2({ key, body: buffer, contentType: declaredType, access: folder === "prescriptions" ? "private" : "public", metadata: { ownerid: ownerId, originalname: fileName, category: folder } })
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: "Unsupported Content-Type." }, { status: 415 })
  } catch {
    return publicError("The file could not be stored. Please try again.")
  }
}
