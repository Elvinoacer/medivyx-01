"use client"

// Client-side Push Notification and Firebase helper for Sphere Pharmacy.
// Manages Service Worker registration, push permission requests, token registration,
// and foreground notification reception.

import { toast } from "sonner"

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined") return false
  return "serviceWorker" in navigator && "Notification" in window && "PushManager" in window
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
    return { success: false, error: "Push notifications are not supported by your browser." }
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      return { success: false, error: "Push notification permission was denied." }
    }

    // 2. Register service worker
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    })
    await navigator.serviceWorker.ready

    // 3. Obtain push subscription / token
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim()
    let tokenString = ""

    if (vapidKey) {
      try {
        let subscription = await registration.pushManager.getSubscription()
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
          })
        }
        tokenString = JSON.stringify(subscription)
      } catch (subErr) {
        console.warn("[Push Subscribe Warning] Fallback to device registration", subErr)
      }
    }

    // If no VAPID key or fallback, use a device token string
    if (!tokenString) {
      const stored = localStorage.getItem("sphere_device_token")
      if (stored) {
        tokenString = stored
      } else {
        tokenString = `dev_fcm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        localStorage.setItem("sphere_device_token", tokenString)
      }
    }

    // 4. Send token to server
    const res = await fetch("/api/notifications/push-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: tokenString,
        platform: navigator.userAgent.slice(0, 150),
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { success: false, error: err.error || "Failed to register push token with server." }
    }

    return { success: true, token: tokenString }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[Push Error]", msg)
    return { success: false, error: msg }
  }
}

/**
 * Unsubscribe current device from push notifications.
 */
export async function disablePushNotifications(): Promise<boolean> {
  try {
    if (!isPushNotificationSupported()) return false

    const registration = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js")
    if (registration) {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
    }

    const deviceToken = localStorage.getItem("sphere_device_token")
    if (deviceToken) {
      await fetch("/api/notifications/push-token", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: deviceToken }),
      }).catch(() => {})
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
      toast(title || "Sphere Pharmacy", {
        description: body,
        action: url
          ? {
              label: "View",
              onClick: () => {
                window.location.href = url
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
