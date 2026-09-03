"use client"

import { useState } from "react"
import { Crosshair, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export type ResolvedLocation = {
  displayName: string
  area: string | null
  city: string | null
  latitude: number
  longitude: number
}

export function UseCurrentLocationButton({
  disabled,
  onResolved,
}: {
  disabled?: boolean
  onResolved: (location: ResolvedLocation) => void
}) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function useLocation() {
    setMessage(null)
    if (!("geolocation" in navigator)) {
      setMessage("Your browser does not support location.")
      return
    }

    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/location/reverse-geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data?.error || "Could not find your address.")
          onResolved(data)
          setMessage("Location found. Please check the address and delivery zone before saving.")
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Could not find your address.")
        } finally {
          setLoading(false)
        }
      },
      (error) => {
        const messages: Record<number, string> = {
          1: "Location permission was denied. Allow location access and try again.",
          2: "We couldn't determine your location. Check your signal and try again.",
          3: "Location lookup timed out. Please try again.",
        }
        setMessage(messages[error.code] || "Could not determine your current location.")
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

  return (
    <div className="space-y-1.5">
      <Button type="button" variant="outline" className="w-full gap-2 rounded-xl sm:w-auto" onClick={useLocation} disabled={disabled || loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        {loading ? "Finding your location…" : "Use my current location"}
      </Button>
      {message ? <p className="text-xs text-muted-foreground" role="status">{message}</p> : null}
    </div>
  )
}
