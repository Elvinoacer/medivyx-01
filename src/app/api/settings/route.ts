import { NextResponse } from "next/server"
import { audit } from "@/lib/notify"
import { requireStaff } from "@/lib/session"
import { getSettings, saveSettingsSection } from "@/lib/settings"

export async function GET() {
  const { pharmacy, delivery, compliance } = await getSettings()
  return NextResponse.json({ pharmacy, delivery, compliance })
}

export async function PUT(request: Request) {
  const { session, error } = await requireStaff(["ADMIN"])
  if (error) return error
  try {
    const body = await request.json()
    if (body.pharmacy) {
      await saveSettingsSection("pharmacy", body.pharmacy)
      await audit(session.staffName ?? "Admin", "ADMIN", "SETTINGS_UPDATED", "Setting", "pharmacy", "Pharmacy profile updated")
    }
    if (body.delivery) {
      const zones = Array.isArray(body.delivery.zones)
        ? body.delivery.zones
            .map((z: { name?: unknown; fee?: unknown }) => ({ name: String(z.name ?? "").trim(), fee: Math.max(0, Number(z.fee) || 0) }))
            .filter((z: { name: string }) => z.name.length > 0)
        : undefined
      const distanceBands = Array.isArray(body.delivery.distanceBands)
        ? body.delivery.distanceBands
            .map((band: { id?: unknown; minKm?: unknown; maxKm?: unknown; fee?: unknown; label?: unknown }, index: number) => ({
              id: String(band.id ?? "band-" + index),
              minKm: Math.max(0, Number(band.minKm) || 0),
              maxKm: band.maxKm === null || band.maxKm === "" || band.maxKm === undefined ? null : Math.max(0, Number(band.maxKm) || 0),
              fee: Math.max(0, Number(band.fee) || 0),
              label: String(band.label ?? "Distance band " + (index + 1)).trim(),
            }))
            .filter((band: { label: string; maxKm: number | null; minKm: number }) => band.label.length > 0 && (band.maxKm === null || band.maxKm > band.minKm))
        : undefined
      const pharmacyLocation =
        body.delivery.pharmacyLocation &&
        Number.isFinite(Number(body.delivery.pharmacyLocation.latitude)) &&
        Number.isFinite(Number(body.delivery.pharmacyLocation.longitude))
          ? {
              latitude: Number(body.delivery.pharmacyLocation.latitude),
              longitude: Number(body.delivery.pharmacyLocation.longitude),
              label: String(body.delivery.pharmacyLocation.label ?? "Pharmacy"),
            }
          : undefined
      if (body.delivery.pricingMode === "distance" && (!pharmacyLocation || !distanceBands?.length)) {
        return NextResponse.json({ error: "Distance pricing needs a pinned pharmacy location and at least one valid distance band." }, { status: 400 })
      }
      await saveSettingsSection("delivery", {
        ...body.delivery,
        ...(zones ? { zones } : {}),
        ...(distanceBands ? { distanceBands } : {}),
        ...(pharmacyLocation ? { pharmacyLocation } : {}),
      })
      await audit(session.staffName ?? "Admin", "ADMIN", "SETTINGS_UPDATED", "Setting", "delivery", "Delivery settings updated")
    }
    if (body.compliance) {
      await saveSettingsSection("compliance", body.compliance)
      await audit(session.staffName ?? "Admin", "ADMIN", "COMPLIANCE_UPDATED", "Setting", "compliance", "Compliance/licence details updated")
    }
    const settings = await getSettings()
    return NextResponse.json({ ok: true, ...settings })
  } catch {
    return NextResponse.json({ error: "Could not save the settings." }, { status: 500 })
  }
}
