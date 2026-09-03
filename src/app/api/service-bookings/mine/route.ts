import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireCustomer } from "@/lib/session"

export async function GET(){
 const {session,error}=await requireCustomer()
 if(error)return error
 const list=await db.serviceBooking.findMany({where:{userId:session!.userId!},include:{service:true,statusHistory:{orderBy:{createdAt:"asc"}}},orderBy:{scheduledStart:"desc"}})
 return NextResponse.json(list.map((b:any)=>({id:b.id,reference:b.reference,serviceId:b.serviceId,serviceName:b.service.name,userId:b.userId,customerName:session!.user?.name||null,customerPhone:session!.user?.phone||null,customerEmail:session!.user?.email||null,scheduledStart:b.scheduledStart.toISOString(),scheduledEnd:b.scheduledEnd.toISOString(),status:b.status,customerNotes:b.customerNotes,staffNotes:b.staffNotes,price:b.price,paymentStatus:b.paymentStatus,createdAt:b.createdAt.toISOString(),updatedAt:b.updatedAt.toISOString(),statusHistory:b.statusHistory.map((h:any)=>({...h,createdAt:h.createdAt.toISOString()}))})))
}
