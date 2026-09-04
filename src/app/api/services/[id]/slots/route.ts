import { NextResponse } from "next/server"
import { db } from "@/lib/db"

function parseDate(value:string){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if(!m)return null
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3])
  const date=new Date(Date.UTC(y,mo-1,d))
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==mo-1||date.getUTCDate()!==d)return null
  return date
}
function localMinutes(value:string){
  const m=/^(\d{2}):(\d{2})$/.exec(value)
  if(!m)return null
  const h=Number(m[1]),min=Number(m[2])
  if(h>23||min>59)return null
  return h*60+min
}
function nairobiDate(base:Date,minutes:number){
  return new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate(),Math.floor(minutes/60)-3,minutes%60,0,0))
}
export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
  const {id}=await ctx.params
  const date=parseDate(new URL(request.url).searchParams.get("date")||"")
  if(!date)return NextResponse.json({error:"A valid date is required (YYYY-MM-DD)."},{status:400})
  const service=await db.service.findUnique({where:{id},include:{availability:{where:{enabled:true},orderBy:{startTime:"asc"}}}})
  if(!service||!service.active)return NextResponse.json({error:"Service not found."},{status:404})
  const rules=service.availability.filter(r=>r.dayOfWeek===date.getUTCDay())
  const dayStart=nairobiDate(date,0),dayEnd=nairobiDate(date,24*60)
  const bookings=await db.serviceBooking.findMany({where:{serviceId:id,status:{notIn:["CANCELLED","REJECTED","NO_SHOW"]},scheduledStart:{lt:dayEnd},scheduledEnd:{gt:dayStart}},select:{scheduledStart:true,scheduledEnd:true}})
  const slots:{start:string;end:string;label:string}[]=[]
  for(const rule of rules){
    const startMinutes=localMinutes(rule.startTime),endMinutes=localMinutes(rule.endTime)
    if(startMinutes===null||endMinutes===null||endMinutes<=startMinutes)continue
    for(let minutes=startMinutes;minutes+service.durationMinutes<=endMinutes;minutes+=service.durationMinutes){
      const start=nairobiDate(date,minutes),end=nairobiDate(date,minutes+service.durationMinutes)
      if(start<=new Date())continue
      const overlap=bookings.some((booking)=>booking.scheduledStart<end&&booking.scheduledEnd>start)
      if(!overlap)slots.push({start:start.toISOString(),end:end.toISOString(),label:start.toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",hour12:true,timeZone:"Africa/Nairobi"})})
    }
  }
  return NextResponse.json(slots)
}
