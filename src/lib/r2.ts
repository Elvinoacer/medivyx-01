/**
 * Cloudflare R2 Storage Client.
 * S3-compatible object storage for prescriptions, product media, user avatars, and system assets.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "d25ee224717e0642b3847d282009cb30"
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "3511c7c26d8be71d376d5ec8934b5d9d"
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "f9b983031c3821cb1c0aeff10fcbbd7fad13f28792db3b2add8fd97b13093c78"
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "gtss"
export const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.R2_PUBLIC_URL ||
  "https://pub-cc07856d657b4a7197710051042b3eda.r2.dev"

const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`

export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

export function isR2Configured(): boolean {
  return Boolean(R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME)
}

/** Returns the publicly accessible CDN URL for an R2 key */
export function getR2PublicUrl(key: string): string {
  const cleanKey = key.startsWith("/") ? key.slice(1) : key
  const base = R2_PUBLIC_URL.replace(/\/+$/, "")
  return `${base}/${cleanKey}`
}

export interface UploadOptions {
  key: string
  body: Buffer | Uint8Array | string
  contentType: string
  metadata?: Record<string, string>
  cacheControl?: string
}

export interface UploadResult {
  key: string
  url: string
  size: number
  contentType: string
}

/**
 * Uploads a buffer or string to Cloudflare R2 bucket.
 */
export async function uploadToR2(options: UploadOptions): Promise<UploadResult> {
  const { key, body, contentType, metadata, cacheControl = "public, max-age=31536000, immutable" } = options
  const buffer = typeof body === "string" ? Buffer.from(body) : Buffer.from(body)

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: cacheControl,
    Metadata: metadata,
  })

  await r2Client.send(command)

  return {
    key,
    url: getR2PublicUrl(key),
    size: buffer.byteLength,
    contentType,
  }
}

/**
 * Uploads base64 encoded data to R2.
 */
export async function uploadBase64ToR2(
  base64Data: string,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  // Strip data URL header if present (e.g. "data:image/png;base64,")
  const rawBase64 = base64Data.includes(",") ? base64Data.split(",")[1]! : base64Data
  const buffer = Buffer.from(rawBase64, "base64")

  return uploadToR2({
    key,
    body: buffer,
    contentType,
    metadata,
  })
}

/**
 * Generates a presigned GET URL for secure, time-limited private downloads.
 * Suitable for sensitive medical prescriptions.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
}

/**
 * Generates a presigned PUT URL allowing clients to upload directly to R2.
 * Great for large files (>10MB).
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds })
  return {
    uploadUrl,
    key,
    publicUrl: getR2PublicUrl(key),
  }
}

/**
 * Deletes an object from Cloudflare R2 bucket.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(command)
}

/**
 * Checks if an object exists in Cloudflare R2 bucket.
 */
export async function objectExistsInR2(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    })
    await r2Client.send(command)
    return true
  } catch {
    return false
  }
}
