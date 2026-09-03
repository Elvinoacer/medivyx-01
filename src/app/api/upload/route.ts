import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { uploadToR2, uploadBase64ToR2, getPresignedUploadUrl } from "@/lib/r2"
import { v4 as uuidv4 } from "uuid"

const ALLOWED_FOLDERS = ["products", "prescriptions", "avatars", "services", "general"] as const
type Folder = (typeof ALLOWED_FOLDERS)[number]

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
])

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15MB

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 80)
}

/**
 * Universal Cloudflare R2 Upload Endpoint.
 * Supports multipart/form-data, base64 JSON, and direct-to-R2 presigned upload requests.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession()
    const contentTypeHeader = request.headers.get("content-type") || ""

    // Case 1: JSON body (Base64 upload or Presign request)
    if (contentTypeHeader.includes("application/json")) {
      const body = await request.json()
      const folder: Folder = ALLOWED_FOLDERS.includes(body.folder) ? body.folder : "general"

      // Security check for protected folders
      if ((folder === "products" || folder === "services") && !session?.staffId) {
        return NextResponse.json({ error: "Only staff can upload product media." }, { status: 403 })
      }
      if ((folder === "avatars" || folder === "prescriptions") && !session?.userId && !session?.staffId) {
        return NextResponse.json({ error: "Authentication required to upload here." }, { status: 401 })
      }

      // Presign mode: return presigned PUT URL for direct browser-to-R2 upload
      if (body.action === "presign") {
        const rawName = String(body.fileName || "upload")
        const fileType = String(body.fileType || "image/jpeg")
        if (!ALLOWED_MIME_TYPES.has(fileType)) {
          return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
        }
        const ext = rawName.includes(".") ? `.${rawName.split(".").pop()}` : ""
        const sanitized = sanitizeFileName(rawName.replace(/\.[^/.]+$/, ""))
        const key = `${folder}/${Date.now()}_${uuidv4().slice(0, 8)}_${sanitized}${ext}`

        const presigned = await getPresignedUploadUrl(key, fileType)
        return NextResponse.json(presigned)
      }

      // Base64 upload mode
      const { fileData, fileName = "file", fileType = "image/jpeg" } = body
      if (!fileData) {
        return NextResponse.json({ error: "Missing fileData in request." }, { status: 400 })
      }
      if (!ALLOWED_MIME_TYPES.has(fileType)) {
        return NextResponse.json({ error: "Unsupported file type." }, { status: 400 })
      }

      const ext = fileName.includes(".") ? `.${fileName.split(".").pop()}` : ""
      const sanitized = sanitizeFileName(fileName.replace(/\.[^/.]+$/, ""))
      const prefix = folder === "prescriptions" && session?.userId ? `prescriptions/${session.userId}` : folder
      const key = `${prefix}/${Date.now()}_${uuidv4().slice(0, 8)}_${sanitized}${ext}`

      const result = await uploadBase64ToR2(fileData, key, fileType, {
        uploadedBy: session?.userId || session?.staffId || "anonymous",
        originalName: fileName,
      })

      return NextResponse.json(result)
    }

    // Case 2: Multipart form-data
    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      const folderParam = formData.get("folder") as string | null
      const folder: Folder = folderParam && ALLOWED_FOLDERS.includes(folderParam as Folder)
        ? (folderParam as Folder)
        : "general"

      if (!file) {
        return NextResponse.json({ error: "No file provided in form data." }, { status: 400 })
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File exceeds 15MB limit." }, { status: 400 })
      }

      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 })
      }

      // Permissions check
      if (folder === "products" && !session?.staffId) {
        return NextResponse.json({ error: "Only staff can upload product media." }, { status: 403 })
      }
      if ((folder === "avatars" || folder === "prescriptions") && !session?.userId && !session?.staffId) {
        return NextResponse.json({ error: "Authentication required." }, { status: 401 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const rawName = file.name || "upload"
      const ext = rawName.includes(".") ? `.${rawName.split(".").pop()}` : ""
      const sanitized = sanitizeFileName(rawName.replace(/\.[^/.]+$/, ""))
      const prefix = folder === "prescriptions" && session?.userId ? `prescriptions/${session.userId}` : folder
      const key = `${prefix}/${Date.now()}_${uuidv4().slice(0, 8)}_${sanitized}${ext}`

      const result = await uploadToR2({
        key,
        body: buffer,
        contentType: file.type,
        metadata: {
          originalName: file.name,
          uploadedBy: session?.userId || session?.staffId || "guest",
        },
      })

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: "Unsupported Content-Type header." }, { status: 400 })
  } catch (err) {
    console.error("[R2 Upload Error]", err)
    const msg = err instanceof Error ? err.message : "Failed to upload file to storage."
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
