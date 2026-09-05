import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireCustomer } from "@/lib/session"
import { notifyServiceBooking } from "@/lib/notify"
import { notifyStaff } from "@/lib/notify"
import { randomBytes } from "crypto"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"

function ref(){return "SPB-"+randomBytes(6).toString("hex").toUpperCase()}
function nairobiParts(date:Date){const parts=new Intl.DateTimeFormat("en-KE",{timeZone:"Africa/Nairobi",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date);const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";const day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(get("weekday"));return {day,minutes:Number(get("hour"))*60+Number(get("minute"))}}

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
 const tooLarge=rejectOversizedRequest(request,16_384);if(tooLarge)return tooLarge
 const limited=await enforceRateLimit(request,"service-booking",8,60*60_000,session!.userId!);if(limited)return limited
 const body=await request.json()
 const service=await db.service.findUnique({where:{id:String(body.serviceId)},include:{availability:{where:{enabled:true}}}})
 if(!service||!service.active)return NextResponse.json({error:"Service is not available."},{status:404})
 if(Object.prototype.hasOwnProperty.call(body,"expectedPrice") && (body.expectedPrice === null ? service.price !== null : !Number.isFinite(body.expectedPrice) || Number(service.price) !== body.expectedPrice))return NextResponse.json({error:"The service price changed. Review the updated price before booking."},{status:409})
 const start=new Date(String(body.start))
 const end=new Date(String(body.end))
 if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return NextResponse.json({error:"Invalid appointment time."},{status:400})
 if(end.getTime()-start.getTime()!==service.durationMinutes*60000)return NextResponse.json({error:"Appointment duration does not match the selected service."},{status:400})
 if(start<new Date())return NextResponse.json({error:"Please choose a future appointment."},{status:400})
 if(start.getTime()>Date.now()+180*86400000)return NextResponse.json({error:"Appointments can be booked up to 180 days ahead."},{status:400})
 const startLocal=nairobiParts(start), endLocal=nairobiParts(end)
 if(startLocal.day!==endLocal.day)return NextResponse.json({error:"Appointment must fit within one Nairobi day."},{status:400})
 const day=startLocal.day
 const mins=startLocal.minutes
 const endMins=endLocal.minutes
 const allowed=service.availability.some((r:any)=>r.dayOfWeek===day&&mins>=Number(r.startTime.slice(0,2))*60+Number(r.startTime.slice(3))&&endMins<=Number(r.endTime.slice(0,2))*60+Number(r.endTime.slice(3)))
 if(!allowed)return NextResponse.json({error:"That time is outside service availability."},{status:409})
 const conflict=await db.serviceBooking.findFirst({where:{serviceId:service.id,status:{notIn:["CANCELLED","REJECTED","NO_SHOW"]},scheduledStart:{lt:end},scheduledEnd:{gt:start}}})
 if(conflict)return NextResponse.json({error:"That slot was just booked. Please choose another time."},{status:409})
 const notes=body.customerNotes?String(body.customerNotes).trim():null
 if(notes&&notes.length>1000)return NextResponse.json({error:"Booking notes are too long."},{status:400})
 let created
 try{created=await db.serviceBooking.create({data:{reference:ref(),serviceId:service.id,userId:session!.userId!,scheduledStart:start,scheduledEnd:end,status:"PENDING",customerNotes:notes,price:service.price,paymentStatus:"UNPAID",statusHistory:{create:{status:"PENDING",actor:"CUSTOMER"}}},include:{service:true,statusHistory:{orderBy:{createdAt:"asc"}}}})}catch{return NextResponse.json({error:"That slot was just booked. Please choose another time."},{status:409})}
 await notifyServiceBooking({
  userId: session!.userId!,
  customerName: session!.user?.name,
  customerEmail: session!.user?.email,
  reference: created.reference,
  serviceName: service.name,
  status: "PENDING",
  message: `We received your booking request for ${service.name}. Our pharmacy team will confirm the appointment shortly.`,
  start: created.scheduledStart,
  end: created.scheduledEnd,
  bookingId: created.id,
 })
 await notifyStaff({
  roles: ["ADMIN","PHARMACIST","STAFF"],
  event: "SERVICE_BOOKING",
  title: "New care service booking",
  message: `${session!.user?.name || "A customer"} requested ${service.name} for ${created.scheduledStart.toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"})}.`,
  link: `${process.env.NEXT_PUBLIC_APP_URL || "https://spherepharmacy.co.ke"}/#admin`,
  metadata: { bookingId: created.id, reference: created.reference, serviceName: service.name },
  details: { Reference: created.reference, Service: service.name },
 })
 return NextResponse.json({...created,serviceName:service.name,statusHistory:created.statusHistory.map((h:any)=>({...h,createdAt:h.createdAt.toISOString()})),createdAt:created.createdAt.toISOString(),updatedAt:created.updatedAt.toISOString(),scheduledStart:created.scheduledStart.toISOString(),scheduledEnd:created.scheduledEnd.toISOString(),customerName:session!.user?.name,customerPhone:session!.user?.phone,customerEmail:session!.user?.email},{status:201})
}
