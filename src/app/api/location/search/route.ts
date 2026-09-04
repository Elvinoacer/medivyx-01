import { NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/security/request"

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "location-search", 30, 10 * 60_000)
  if (limited) return limited
  const q = new URL(request.url).searchParams.get("q")?.trim() || ""
  if (q.length > 120) return NextResponse.json({ error: "Search is too long." }, { status: 400 })
  if (q.length < 2) return NextResponse.json({ results: [] })
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("format","jsonv2")
  url.searchParams.set("q",q)
  url.searchParams.set("limit","5")
  url.searchParams.set("countrycodes","ke")
  url.searchParams.set("addressdetails","1")
  url.searchParams.set("accept-language","en")
  const response = await fetch(url,{headers:{ "User-Agent":"SpherePharmacy/1.0 (admin delivery location lookup)", Accept:"application/json" },cache:"no-store"})
  if(!response.ok)return NextResponse.json({error:"Location search is unavailable right now."},{status:502})
  const rows=await response.json()
  return NextResponse.json({results:rows.map((r:any)=>({displayName:r.display_name,latitude:Number(r.lat),longitude:Number(r.lon)}))})
}
