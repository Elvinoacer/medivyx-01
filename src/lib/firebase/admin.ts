// Firebase Cloud Messaging (FCM) Push Notification Service for Medivyx
// Adheres to the official Google Firebase Cloud Messaging HTTP v1 API.
// Generates OAuth2 bearer tokens directly via Google Service Account (RS256 JWT)
// without requiring heavy external dependencies.

import crypto from "crypto"
import { db } from "@/lib/db"

export interface PushNotificationOptions {
  tokens: string[]
  title: string
  body: string
  icon?: string
  badge?: string
  data?: Record<string, string>
  link?: string
}

export interface PushResult {
  success: boolean
  sentCount: number
  failedCount: number
  error?: string
  simulated?: boolean
  invalidTokens?: string[]
}

// In-memory token cache to prevent requesting OAuth2 access tokens on every push
let cachedAccessToken: string | null = null
let tokenExpiresAt = 0

function getServiceAccountCredentials(): {
  projectId: string
  clientEmail: string
  privateKey: string
} | null {
  // Option 1: Full JSON string in environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      }
    } catch {
      console.warn("[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON")
    }
  }

  // Option 2: Individual environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY

  if (projectId && clientEmail && privateKey) {
    // Replace escaped newlines if passed in string form
    privateKey = privateKey.replace(/\\n/g, "\n")
    return { projectId, clientEmail, privateKey }
  }

  return null
}

/**
 * Mint a Google OAuth2 access token for Firebase Messaging using service account credentials.
 */
async function getGoogleAccessToken(creds: {
  clientEmail: string
  privateKey: string
}): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000)

  // Use cached token if valid for at least another 5 minutes
  if (cachedAccessToken && tokenExpiresAt > now + 300) {
    return cachedAccessToken
  }

  try {
    const header = {
      alg: "RS256",
      typ: "JWT",
    }

    const payload = {
      iss: creds.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }

    const base64Url = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url")

    const unsignedToken = `${base64Url(header)}.${base64Url(payload)}`

    const signer = crypto.createSign("RSA-SHA256")
    signer.update(unsignedToken)
    const signature = signer.sign(creds.privateKey, "base64url")

    const jwt = `${unsignedToken}.${signature}`

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn(`[Firebase Auth] Failed to obtain access token: ${errText}`)
      return null
    }

    const data = await res.json()
    cachedAccessToken = data.access_token
    tokenExpiresAt = now + (data.expires_in || 3600)
    return cachedAccessToken
  } catch (err) {
    console.error("[Firebase Auth Exception]", err)
    return null
  }
}

/**
 * Send push notifications to an array of FCM registration tokens.
 */
export async function sendPushNotification(
  opts: PushNotificationOptions
): Promise<PushResult> {
  const { tokens, title, body, icon, badge, data = {}, link } = opts

  if (!tokens || tokens.length === 0) {
    return { success: true, sentCount: 0, failedCount: 0 }
  }

  // De-duplicate tokens
  const uniqueTokens = Array.from(new Set(tokens.filter(Boolean)))
  const creds = getServiceAccountCredentials()

  // Fail closed when live Firebase credentials are not configured.
  if (!creds) {
    return {
      success: false,
      sentCount: 0,
      failedCount: uniqueTokens.length,
      error: "Firebase server credentials are not configured.",
    }
  }

  const accessToken = await getGoogleAccessToken(creds)
  if (!accessToken) {
    return {
      success: false,
      sentCount: 0,
      failedCount: uniqueTokens.length,
      error: "Firebase authentication failed. Check the service-account credentials and Cloud Messaging API access.",
    }
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${creds.projectId}/messages:send`
  const defaultIcon = "/favicon.ico"
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://medivyx.co.ke")
  const target = new URL(link || "/account", origin)
  const clickAction = target.origin === origin.origin ? target.href : origin.href

  const invalidTokens: string[] = []
  let sentCount = 0
  let failedCount = 0

  await Promise.allSettled(
    uniqueTokens.map(async (token) => {
      try {
        const payload = {
          message: {
            token,
            notification: {
              title,
              body,
            },
            webpush: {
              notification: {
                title,
                body,
                icon: icon || defaultIcon,
                badge: badge || "/favicon.ico",
                click_action: clickAction,
              },
              fcm_options: {
                link: clickAction,
              },
              headers: {
                Urgency: "high",
              },
            },
            data: {
              ...data,
              title,
              body,
              url: clickAction,
              timestamp: String(Date.now()),
            },
          },
        }

        const res = await fetch(endpoint, {
          method: "POST",
      signal: AbortSignal.timeout(12_000),
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (res.ok) {
          sentCount++
        } else {
          failedCount++
          const resText = await res.text()
          // Check if token is expired, unregistered, or invalid
          if (
            resText.includes("UNREGISTERED") ||
            resText.includes("registration-token-not-registered")
          ) {
            invalidTokens.push(token)
          }
          console.warn(JSON.stringify({ level: "warn", event: "fcm_delivery_failed", status: res.status }))
        }
      } catch (err) {
        failedCount++
        console.error("[Firebase FCM Error]", err)
      }
    })
  )

  // Automatically prune dead/invalid tokens from the database to keep tables clean
  if (invalidTokens.length > 0) {
    try {
      await db.pushToken.deleteMany({
        where: { token: { in: invalidTokens } },
      })
      console.info(`[Firebase FCM Prune] Removed ${invalidTokens.length} expired FCM token(s).`)
    } catch (cleanupErr) {
      console.warn("[Firebase FCM Prune Error]", cleanupErr)
    }
  }

  return {
    success: failedCount === 0,
    sentCount,
    failedCount,
    error: failedCount > 0 && sentCount === 0 ? "Firebase rejected every registered device token." : undefined,
    invalidTokens,
  }
}
