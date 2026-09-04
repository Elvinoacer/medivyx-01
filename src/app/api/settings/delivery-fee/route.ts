import { NextResponse } from "next/server"
import { computeDeliveryFee, getSettings, distanceKm } from "@/lib/settings"

export async function GET(request:Request){
 const url=new URL(request.url)
 const area=url.searchParams.get("area")??""
 const latRaw=url.searchParams.get("lat"),lonRaw=url.searchParams.get("lon")
 const lat=latRaw===null?null:Number(latRaw)
 const lon=lonRaw===null?null:Number(lonRaw)
 const subtotal=Number(url.searchParams.get("subtotal"))||0
 const hasCoords=lat!==null&&lon!==null&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180
 const {delivery}=await getSettings()
 const fee=computeDeliveryFee(area,delivery,subtotal,hasCoords?lat:null,hasCoords?lon:null)
 const km=hasCoords&&delivery.pharmacyLocation?.latitude!=null&&delivery.pharmacyLocation?.longitude!=null
   ? distanceKm(delivery.pharmacyLocation.latitude,delivery.pharmacyLocation.longitude,lat!,lon!):null
 return NextResponse.json({fee,freeOver:delivery.freeOver,mode:delivery.mode,pricingMode:delivery.pricingMode??"zone",distanceKm:km})
}
