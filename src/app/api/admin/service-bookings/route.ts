import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

function can(session:any){return Boolean(session?.staffId&&["ADMIN","PHARMACIST","STAFF"].includes(session.role))}
export async function GET(request:Request){
 const s=await getSession(); if(!can(s))return NextResponse.json({error:"Staff access required."},{status:403})
 const u=new URL(request.url),date=u.searchParams.get("date")
 const where:any={}
 if(date){const start=new Date(date+"T00:00:00"),end=new Date(date+"T23:59:59.999");if(!Number.isNaN(start.getTime()))where.scheduledStart={gte:start,lte:end}}
 const list=await db.serviceBooking.findMany({where,include:{service:true,user:true,statusHistory:{orderBy:{createdAt:"asc"}}},orderBy:{scheduledStart:"asc"}})
 return NextResponse.json(list.map((b:any)=>({id:b.id,reference:b.reference,serviceId:b.serviceId,serviceName:b.service.name,userId:b.userId,customerName:b.user?.name||null,customerPhone:b.user?.phone||null,customerEmail:b.user?.email||null,scheduledStart:b.scheduledStart.toISOString(),scheduledEnd:b.scheduledEnd.toISOString(),status:b.status,customerNotes:b.customerNotes,staffNotes:b.staffNotes,price:b.price,paymentStatus:b.paymentStatus,createdAt:b.createdAt.toISOString(),updatedAt:b.updatedAt.toISOString(),statusHistory:b.statusHistory.map((h:any)=>({...h,createdAt:h.createdAt.toISOString()}))})))
}
export async function PATCH(request:Request){
 const s=await getSession(); if(!can(s))return NextResponse.json({error:"Staff access required."},{status:403})
 const body=await request.json(); const id=String(body.id),status=String(body.status)
 const allowed=["PENDING","CONFIRMED","RESCHEDULED","ARRIVED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW","REJECTED"]
 if(!allowed.includes(status))return NextResponse.json({error:"Invalid booking status."},{status:400})
 const booking=await db.serviceBooking.findUnique({where:{id}}); if(!booking)return NextResponse.json({error:"Booking not found."},{status:404})
 const updated=await db.$transaction(async(tx)=>{
  const b=await tx.serviceBooking.update({where:{id},data:{status,staffNotes:body.staffNotes!==undefined?String(body.staffNotes):booking.staffNotes}})
  await tx.serviceBookingStatusHistory.create({data:{bookingId:id,status,note:body.note?String(body.note):null,actor:s!.staffId!}})
  return b
 })
 return NextResponse.json({ok:true,status:updated.status})
}
