// Service Worker for Sphere Pharmacy Push Notifications
// Handles background push events from Firebase Cloud Messaging (FCM) and Web Push.

self.addEventListener("install", (event) => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle background push messages. If the app is visible, hand the payload to
// the page so it can render the in-app toast instead of showing a duplicate
// system notification.
self.addEventListener("push", (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = {
      notification: {
        title: "Sphere Pharmacy",
        body: event.data.text(),
      },
    }
  }

  // Extract notification fields from standard Webpush or FCM v1 format
  const notification = payload.notification || {}
  const data = payload.data || {}

  const title = notification.title || data.title || "Sphere Pharmacy Update"
  const body = notification.body || data.body || "You have a new notification from Sphere Pharmacy."
  const icon = notification.icon || data.icon || "/logo.svg"
  const badge = notification.badge || data.badge || "/logo.svg"
  const targetUrl = data.url || notification.click_action || "/"

  const options = {
    body,
    icon,
    badge,
    data: {
      url: targetUrl,
      ...data,
    },
    vibrate: [100, 50, 100],
    tag: data.event || "sphere-notification",
    renotify: true,
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const visibleClients = clientList.filter((client) => client.visibilityState === "visible")
      if (visibleClients.length) {
        visibleClients.forEach((client) => {
          client.postMessage({
            type: "PUSH_NOTIFICATION",
            payload: { title, body, url: targetUrl, ...data },
          })
        })
        return
      }

      return self.registration.showNotification(title, options)
    })
  )
})

// Handle notification click: navigate or focus existing window
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl)
            }
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})
