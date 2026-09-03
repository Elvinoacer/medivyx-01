import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireCustomer } from "@/lib/session"

function ref(){return "SPB-"+Math.random().toString(36).slice(2,8).toUpperCase()}
function startOfDay(date:Date){const d=new Date(date);d.setHours(0,0,0,0);return d}

export async function GET(){
 const {session,error}=await requireCustomer()
 if(error)return error
 const list=await db.serviceBooking.findMany({
  where:{userId:session!.userId!},
  include:{service:true,statusHistory:{orderBy:{createdAt:"asc"}}},
  orderBy:{scheduledStart:"desc"},
 })
 return NextResponse.json(list.map((b:any)=>({
  ...b,serviceName:b.service.name,customerName:session!.user?.name||null,customerPhone:session!.user?.phone||null,customerEmail:session!.user?.email||null,
  createdAt:b.createdAt.toISOString(),updatedAt:b.updatedAt.toISOString(),scheduledStart:b.scheduledStart.toISOString(),scheduledEnd:b.scheduledEnd.toISOString(),
  statusHistory:b.statusHistory.map((h:any)=>({...h,createdAt:h.createdAt.toISOString()}))
 })))
}

export async function POST(request:Request){
 const {session,error}=await requireCustomer()
 if(error)return error
 const body=await request.json()
 const service=await db.service.findUnique({where:{id:String(body.serviceId)},include:{availability:{where:{enabled:true}}}})
 if(!service||!service.active)return NextResponse.json({error:"Service is not available."},{status:404})
 const start=new Date(String(body.start))
 const end=new Date(String(body.end))
 if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return NextResponse.json({error:"Invalid appointment time."},{status:400})
 if(end.getTime()-start.getTime()!==service.durationMinutes*60000)return NextResponse.json({error:"Appointment duration does not match the selected service."},{status:400})
 if(start<new Date())return NextResponse.json({error:"Please choose a future appointment."},{status:400})
 if(startOfDay(start).getTime()!==startOfDay(end).getTime())return NextResponse.json({error:"Appointment must fit within one day."},{status:400})
 const day=start.getDay()
 const mins=start.getHours()*60+start.getMinutes()
 const endMins=end.getHours()*60+end.getMinutes()
 const allowed=service.availability.some((r:any)=>r.dayOfWeek===day&&mins>=Number(r.startTime.slice(0,2))*60+Number(r.startTime.slice(3))&&endMins<=Number(r.endTime.slice(0,2))*60+Number(r.endTime.slice(3)))
 if(!allowed)return NextResponse.json({error:"That time is outside service availability."},{status:409})
 const conflict=await db.serviceBooking.findFirst({where:{serviceId:service.id,status:{notIn:["CANCELLED","REJECTED","NO_SHOW"]},scheduledStart:{lt:end},scheduledEnd:{gt:start}}})
 if(conflict)return NextResponse.json({error:"That slot was just booked. Please choose another time."},{status:409})
 const created=await db.serviceBooking.create({data:{reference:ref(),serviceId:service.id,userId:session!.userId!,scheduledStart:start,scheduledEnd:end,status:"PENDING",customerNotes:body.customerNotes?String(body.customerNotes):null,price:service.price,paymentStatus:"UNPAID",statusHistory:{create:{status:"PENDING",actor:"CUSTOMER"}}},include:{service:true,statusHistory:{orderBy:{createdAt:"asc"}}}})
 return NextResponse.json({...created,serviceName:service.name,statusHistory:created.statusHistory.map((h:any)=>({...h,createdAt:h.createdAt.toISOString()})),createdAt:created.createdAt.toISOString(),updatedAt:created.updatedAt.toISOString(),scheduledStart:created.scheduledStart.toISOString(),scheduledEnd:created.scheduledEnd.toISOString(),customerName:session!.user?.name,customerPhone:session!.user?.phone,customerEmail:session!.user?.email},{status:201})
}
