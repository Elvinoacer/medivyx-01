"use client"

import { useState } from "react"
import { CheckCircle2, Crosshair, Loader2, MapPin } from "lucide-react"
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
          setMessage("Location found. Check the address and delivery zone before saving.")
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
    <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-2.5 shadow-sm sm:w-auto sm:min-w-[250px]">
      <Button
        type="button"
        variant="default"
        className="h-11 w-full gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={useLocation}
        disabled={disabled || loading}
        aria-describedby="current-location-hint"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Crosshair className="h-4 w-4" aria-hidden />
        )}
        {loading ? "Finding your location…" : "Use my current location"}
      </Button>
      <p id="current-location-hint" className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-medium text-primary/80">
        <MapPin className="h-3 w-3" aria-hidden />
        Fastest way to fill your address &amp; GPS coordinates
      </p>
      {message ? (
        <p
          className={`mt-1.5 flex items-start gap-1.5 text-xs ${
            message.startsWith("Location found")
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-muted-foreground"
          }`}
          role="status"
        >
          {message.startsWith("Location found") ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : null}
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  )
}
