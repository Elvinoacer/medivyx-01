import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: "Invalid location coordinates." }, { status: 400 })
    }

    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.searchParams.set("format", "jsonv2")
    url.searchParams.set("lat", String(latitude))
    url.searchParams.set("lon", String(longitude))
    url.searchParams.set("zoom", "18")
    url.searchParams.set("addressdetails", "1")
    url.searchParams.set("accept-language", "en")

    const response = await fetch(url, {
      headers: {
        "User-Agent": "SpherePharmacy/1.0 (customer location lookup)",
        Accept: "application/json",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return NextResponse.json({ error: "We couldn't resolve that location right now." }, { status: 502 })
    }

    const data = await response.json()
    const address = data.address || {}
    const parts = [
      address.house_number,
      address.road,
      address.neighbourhood || address.suburb || address.quarter,
      address.city || address.town || address.municipality,
    ].filter(Boolean)

    return NextResponse.json({
      displayName: parts.join(", ") || data.display_name || "Current location",
      area: address.suburb || address.neighbourhood || address.city_district || address.city || null,
      city: address.city || address.town || address.municipality || null,
      latitude,
      longitude,
    })
  } catch (error) {
    console.error("[Reverse geocoding]", error)
    return NextResponse.json({ error: "We couldn't resolve your current location." }, { status: 500 })
  }
}
