"use client"

// Client-side Push Notification and Firebase helper for Sphere Pharmacy.
// Manages Service Worker registration, push permission requests, token registration,
// and foreground notification reception.

import { toast } from "sonner"

export function isPushNotificationSupported(): boolean {
  return false
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
  return { success: false, error: "Browser push is unavailable until Firebase Web Messaging is configured." }
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
