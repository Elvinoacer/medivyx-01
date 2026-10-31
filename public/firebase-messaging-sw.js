// Service Worker for Medivyx Push Notifications
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
        title: "Medivyx",
        body: event.data.text(),
      },
    }
  }

  // Extract notification fields from standard Webpush or FCM v1 format
  const notification = payload.notification || {}
  const data = payload.data || {}

  const title = notification.title || data.title || "Medivyx Update"
  const body = notification.body || data.body || "You have a new notification from Medivyx."
  const icon = notification.icon || data.icon || "/logo.svg"
  const badge = notification.badge || data.badge || "/logo.svg"
  const candidate = new URL(data.url || notification.click_action || "/", self.location.origin)
  const targetUrl = candidate.origin === self.location.origin ? candidate.href : self.location.origin

  const options = {
    body,
    icon,
    badge,
    data: {
      ...data,
      url: targetUrl,
    },
    vibrate: [100, 50, 100],
    tag: data.notificationId || data.event || "medivyx-notification",
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

  const candidate = new URL(event.notification.data?.url || "/", self.location.origin)
  const targetUrl = candidate.origin === self.location.origin ? candidate.href : self.location.origin

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin && "focus" in client) {
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
