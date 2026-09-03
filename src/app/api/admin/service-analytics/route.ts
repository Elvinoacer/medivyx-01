import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(request:Request){
 const u=new URL(request.url),from=u.searchParams.get("from"),to=u.searchParams.get("to")
 const start=from?new Date(from+"T00:00:00"):new Date(new Date().getTime()-30*86400000)
 const end=to?new Date(to+"T23:59:59.999"):new Date()
 const bookings=await db.serviceBooking.findMany({where:{createdAt:{gte:start,lte:end}},include:{service:true}})
 const completed=bookings.filter(b=>b.status==="COMPLETED")
 const cancelled=bookings.filter(b=>["CANCELLED","REJECTED","NO_SHOW"].includes(b.status))
 const revenue=completed.reduce((n,b)=>n+(b.price||0),0)
 const byService=Object.values(bookings.reduce((acc:any,b)=>{const k=b.service.name;acc[k]??={service:k,bookings:0,completed:0,revenue:0};acc[k].bookings++;if(b.status==="COMPLETED"){acc[k].completed++;acc[k].revenue+=b.price||0}return acc},{}))
 return NextResponse.json({from:start.toISOString(),to:end.toISOString(),totalBookings:bookings.length,completed:completed.length,cancelled:cancelled.length,revenue,completionRate:bookings.length?Number((completed.length/bookings.length*100).toFixed(1)):0,byService:byService.sort((a:any,b:any)=>b.bookings-a.bookings)})
}
