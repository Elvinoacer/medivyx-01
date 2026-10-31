"use client"

// Client-side Push Notification and Firebase helper for Medivyx.
// Manages Service Worker registration, push permission requests, token registration,
// and foreground notification reception.

import { toast } from "sonner"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()

function missingFirebaseConfig(): string[] {
  return Object.entries(firebaseConfig)
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key)
}

async function getFirebaseMessaging() {
  const [{ getApp, getApps, initializeApp }, { getMessaging, isSupported }] = await Promise.all([
    import("firebase/app"),
    import("firebase/messaging"),
  ])

  if (!(await isSupported())) return null

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
  return getMessaging(app)
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined") return false
  return window.isSecureContext && "serviceWorker" in navigator && "Notification" in window && "PushManager" in window
}

export function getPushPermissionState(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied"
  }
  return Notification.permission
}

/**
 * Register the Service Worker and request push notification permissions.
 * Sends the resulting token to /api/notifications/push-token.
 */
export async function enablePushNotifications(): Promise<{
  success: boolean
  token?: string
  error?: string
}> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: "Push alerts require a supported browser on HTTPS (localhost is also supported)." }
  }

  const missing = missingFirebaseConfig()
  if (missing.length || !vapidKey) {
    console.error("[Push] Missing Firebase browser configuration:", [...missing, ...(!vapidKey ? ["vapidKey"] : [])])
    return { success: false, error: "Firebase Web Messaging configuration is incomplete for this deployment." }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return {
        success: false,
        error: permission === "denied"
          ? "Push permission is blocked. Allow notifications for this site in your browser settings and try again."
          : "Push notification permission was not granted.",
      }
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" })
    await navigator.serviceWorker.ready

    const messaging = await getFirebaseMessaging()
    if (!messaging) {
      return { success: false, error: "Firebase Messaging is not supported by this browser." }
    }

    const { getToken } = await import("firebase/messaging")
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    })

    if (!token) {
      return { success: false, error: "Firebase did not return a device token. Please try again." }
    }

    const res = await fetch("/api/notifications/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: navigator.userAgent.slice(0, 150) }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { success: false, error: body.error || "Failed to save this device for push alerts." }
    }

    localStorage.setItem("medivyx_device_token", token)
    localStorage.setItem("sphere_device_token", token)
    return { success: true, token }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[Push] Registration failed:", error)
    if (message.includes("messaging/permission-blocked")) {
      return { success: false, error: "Push permission is blocked in your browser settings." }
    }
    if (message.includes("messaging/invalid-vapid-key")) {
      return { success: false, error: "The configured Firebase Web Push certificate is invalid." }
    }
    return { success: false, error: `Could not enable push alerts: ${message}` }
  }
}

/**
 * Unsubscribe current device from push notifications.
 */
export async function disablePushNotifications(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) return false

    const deviceToken = localStorage.getItem("medivyx_device_token") || localStorage.getItem("sphere_device_token")

    const messaging = await getFirebaseMessaging()
    if (messaging) {
      const { deleteToken } = await import("firebase/messaging")
      await deleteToken(messaging)
    }

    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")
    if (registration) {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
    }

    if (deviceToken) {
      await fetch("/api/notifications/push-token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: deviceToken }),
      }).catch(() => {})
      localStorage.removeItem("medivyx_device_token")
      localStorage.removeItem("sphere_device_token")
    }

    return true
  } catch (e) {
    console.warn("[Disable Push]", e)
    return false
  }
}

/**
 * Listen for foreground push messages from the service worker.
 */
export function setupForegroundNotificationListener(onNotification?: (data: unknown) => void) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return () => {}

  const handler = (event: MessageEvent) => {
    if (event.data && event.data.type === "PUSH_NOTIFICATION") {
      const { title, body, url } = event.data.payload || {}
      toast(title || "Medivyx", {
        description: body,
        action: url
          ? {
              label: "View",
              onClick: () => {
                const target = new URL(url, window.location.origin)
                if (target.origin === window.location.origin) window.location.href = target.href
              },
            }
          : undefined,
      })
      onNotification?.(event.data.payload)
    }
  }

  navigator.serviceWorker.addEventListener("message", handler)
  return () => {
    navigator.serviceWorker.removeEventListener("message", handler)
  }
}
