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
      await saveSettingsSection("delivery", { ...body.delivery, ...(zones ? { zones } : {}) })
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
