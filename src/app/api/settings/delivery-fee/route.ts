import { NextResponse } from "next/server"
import { computeDeliveryFee, getSettings } from "@/lib/settings"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const area = url.searchParams.get("area") ?? ""
  const { delivery } = await getSettings()
  const fee = computeDeliveryFee(area, delivery, 0) // freeOver not applied at quote time
  return NextResponse.json({ fee, freeOver: delivery.freeOver, mode: delivery.mode })
}
