import { db } from "@/lib/db"
import { DELIVERY_DEFAULTS, PHARMACY } from "@/lib/constants"
import type { ComplianceInfo, DeliverySettings, PharmacySettings } from "@/lib/types"

const DEFAULT_COMPLIANCE: ComplianceInfo = {
  premiseLicenceNumber: "",
  premiseLicenceExpiry: "",
  superintendentName: "",
  superintendentReg: "",
  notes:
    "No licence details are displayed publicly yet. The 2024 PPB record found in research is NOT current and must not be published. Complete this section once the client supplies their current licence.",
}

export async function getSettings() {
  const rows = await db.setting.findMany({ where: { key: { in: ["pharmacy", "delivery", "compliance"] } } })
  const map: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      map[row.key] = JSON.parse(row.value)
    } catch {
      /* skip malformed */
    }
  }
  return {
    pharmacy: { ...PHARMACY, ...((map.pharmacy as Partial<PharmacySettings>) ?? {}) } as PharmacySettings,
    delivery: { ...DELIVERY_DEFAULTS, ...((map.delivery as Partial<DeliverySettings>) ?? {}) } as DeliverySettings,
    compliance: { ...DEFAULT_COMPLIANCE, ...((map.compliance as Partial<ComplianceInfo>) ?? {}) } as ComplianceInfo,
  }
}

export async function saveSettingsSection(key: string, value: Record<string, unknown>) {
  const existing = await db.setting.findUnique({ where: { key } })
  if (existing) {
    let current: Record<string, unknown> = {}
    try {
      current = JSON.parse(existing.value)
    } catch {
      /* reset */
    }
    await db.setting.update({ where: { key }, data: { value: JSON.stringify({ ...current, ...value }) } })
  } else {
    await db.setting.create({ data: { key, value: JSON.stringify(value) } })
  }
}

/** Compute delivery fee for an area name using zone settings (falls back to flat mode). */
export function computeDeliveryFee(area: string | null | undefined, settings: DeliverySettings, subtotal: number): number {
  if (settings.mode === "flat") return settings.flatFee
  if (!area) return settings.flatFee
  const zone = (settings.zones ?? []).find((z) => z.name.toLowerCase() === area.toLowerCase().trim())
  const fee = zone ? zone.fee : (settings.zones?.[settings.zones.length - 1]?.fee ?? settings.flatFee)
  if (settings.freeOver && subtotal >= settings.freeOver) return 0
  return fee
}
