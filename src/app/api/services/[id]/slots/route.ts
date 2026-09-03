import { NextResponse } from "next/server"
import { db } from "@/lib/db"

function toDateParts(value:string){
  const [y,m,d]=value.split("-").map(Number)
  if(!y||!m||!d) return null
  const date=new Date(Date.UTC(y,m-1,d))
  if(Number.isNaN(date.getTime())) return null
  return date
}

export async function GET(request:Request,ctx:{params:Promise<{id:string}>}){
 const {id}=await ctx.params
 const dateValue=new URL(request.url).searchParams.get("date")
 const date=toDateParts(dateValue||"")
 if(!date)return NextResponse.json({error:"A valid date is required (YYYY-MM-DD)."}, {status:400})
 const service=await db.service.findUnique({where:{id},include:{availability:{where:{enabled:true},orderBy:{startTime:"asc"}}}})
 if(!service||!service.active)return NextResponse.json({error:"Service not found."},{status:404})
 const dayOfWeek=date.getUTCDay()
 const rules=service.availability.filter(r=>r.dayOfWeek===dayOfWeek)
 const slots:{start:string;end:string;label:string}[]=[]
 for(const rule of rules){
  const [sh,sm]=rule.startTime.split(":").map(Number), [eh,em]=rule.endTime.split(":").map(Number)
  let minutes=sh*60+sm
  const endMinutes=eh*60+em
  while(minutes+service.durationMinutes<=endMinutes){
   const start=new Date(date); start.setUTCHours(Math.floor(minutes/60),minutes%60,0,0)
   const end=new Date(start); end.setUTCMinutes(end.getUTCMinutes()+service.durationMinutes)
   const overlap=await db.serviceBooking.findFirst({where:{serviceId:id,status:{notIn:["CANCELLED","REJECTED","NO_SHOW"]},scheduledStart:{lt:end},scheduledEnd:{gt:start}}})
   if(!overlap){
    slots.push({start:start.toISOString(),end:end.toISOString(),label:start.toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",hour12:true,timeZone:"Africa/Nairobi"})})
   }
   minutes+=service.durationMinutes
  }
 }
 return NextResponse.json(slots)
}
