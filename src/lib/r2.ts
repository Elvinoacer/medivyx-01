import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

interface R2Config { client: S3Client; bucket: string; publicUrl?: string }

function config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET_NAME
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) throw new Error("Private object storage is not configured")
  return {
    bucket,
    publicUrl: process.env.R2_PUBLIC_URL,
    client: new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } }),
  }
}

export function isR2Configured(): boolean {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME)
}

export interface UploadOptions {
  key: string
  body: Buffer | Uint8Array | string
  contentType: string
  metadata?: Record<string, string>
  access?: "private" | "public"
}

export interface UploadResult { key: string; url?: string; size: number; contentType: string }

function publicObjectUrl(base: string | undefined, key: string): string {
  if (!base) throw new Error("R2_PUBLIC_URL is required for public media")
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`
}

export async function uploadToR2(options: UploadOptions): Promise<UploadResult> {
  const { client, bucket, publicUrl } = config()
  const buffer = typeof options.body === "string" ? Buffer.from(options.body) : Buffer.from(options.body)
  const isPublic = options.access === "public"
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: options.key,
    Body: buffer,
    ContentType: options.contentType,
    CacheControl: isPublic ? "public, max-age=31536000, immutable" : "private, no-store, max-age=0",
    Metadata: options.metadata,
  }))
  return { key: options.key, url: isPublic ? publicObjectUrl(publicUrl, options.key) : undefined, size: buffer.byteLength, contentType: options.contentType }
}

export async function uploadBase64ToR2(base64Data: string, key: string, contentType: string, metadata?: Record<string, string>, access: "private" | "public" = "private"): Promise<UploadResult> {
  const rawBase64 = base64Data.includes(",") ? base64Data.slice(base64Data.indexOf(",") + 1) : base64Data
  return uploadToR2({ key, body: Buffer.from(rawBase64, "base64"), contentType, metadata, access })
}

export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const { client, bucket } = config()
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseCacheControl: "private, no-store, max-age=0" }), { expiresIn: Math.min(300, Math.max(30, expiresInSeconds)) })
}

export async function getPresignedUploadUrl(key: string, contentType: string, contentLength: number, metadata: Record<string, string>, expiresInSeconds = 300): Promise<{ uploadUrl: string; key: string }> {
  const { client, bucket } = config()
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength, CacheControl: "private, no-store, max-age=0", Metadata: metadata }), { expiresIn: Math.min(300, Math.max(30, expiresInSeconds)) })
  return { uploadUrl, key }
}

export async function getObjectFromR2(key: string): Promise<{ body: Buffer; contentType: string; metadata: Record<string, string>; size: number }> {
  const { client, bucket } = config()
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!response.Body) throw new Error("Object body is missing")
  const body = Buffer.from(await response.Body.transformToByteArray())
  return { body, contentType: response.ContentType || "application/octet-stream", metadata: response.Metadata || {}, size: response.ContentLength ?? body.byteLength }
}

export async function objectMetadataInR2(key: string): Promise<{ contentType: string; metadata: Record<string, string>; size: number } | null> {
  try {
    const { client, bucket } = config()
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return { contentType: response.ContentType || "application/octet-stream", metadata: response.Metadata || {}, size: response.ContentLength ?? 0 }
  } catch { return null }
}

export async function deleteFromR2(key: string): Promise<void> {
  const { client, bucket } = config()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export async function objectExistsInR2(key: string): Promise<boolean> { return Boolean(await objectMetadataInR2(key)) }
