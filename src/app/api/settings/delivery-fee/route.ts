import { NextResponse } from "next/server"
import { computeDeliveryFee, getSettings, distanceKm } from "@/lib/settings"

export async function GET(request:Request){
 const url=new URL(request.url)
 const area=url.searchParams.get("area")??""
 const lat=Number(url.searchParams.get("lat"))
 const lon=Number(url.searchParams.get("lon"))
 const subtotal=Number(url.searchParams.get("subtotal"))||0
 const hasCoords=Number.isFinite(lat)&&Number.isFinite(lon)
 const {delivery}=await getSettings()
 const fee=computeDeliveryFee(area,delivery,subtotal,hasCoords?lat:null,hasCoords?lon:null)
 const km=hasCoords&&delivery.pharmacyLocation?.latitude!=null&&delivery.pharmacyLocation?.longitude!=null
   ? distanceKm(delivery.pharmacyLocation.latitude,delivery.pharmacyLocation.longitude,lat,lon):null
 return NextResponse.json({fee,freeOver:delivery.freeOver,mode:delivery.mode,pricingMode:delivery.pricingMode??"zone",distanceKm:km})
}
