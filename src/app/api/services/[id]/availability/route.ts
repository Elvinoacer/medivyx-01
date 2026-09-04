import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

function staff(session:any){return Boolean(session?.staffId&&["ADMIN","PHARMACIST","STAFF"].includes(session.staffRole))}

export async function GET(_request:Request,ctx:{params:Promise<{id:string}>}){
 const {id}=await ctx.params
 const service=await db.service.findUnique({where:{id},include:{availability:{orderBy:[{dayOfWeek:"asc"},{startTime:"asc"}]}}})
 if(!service)return NextResponse.json({error:"Service not found."},{status:404})
 return NextResponse.json(service.availability)
}

export async function PUT(request:Request,ctx:{params:Promise<{id:string}>}){
 const session=await getSession()
 if(!staff(session))return NextResponse.json({error:"Staff access required."},{status:403})
 const {id}=await ctx.params
 const service=await db.service.findUnique({where:{id}})
 if(!service)return NextResponse.json({error:"Service not found."},{status:404})
 const body=await request.json()
 if(!Array.isArray(body.availability))return NextResponse.json({error:"availability must be an array."},{status:400})
 if(body.availability.length>35)return NextResponse.json({error:"Too many availability rules."},{status:400})
 const normalized=body.availability.map((x:any)=>({dayOfWeek:Number(x.dayOfWeek),startTime:String(x.startTime),endTime:String(x.endTime),enabled:x.enabled===true}))
 const minutes=(value:string)=>{const match=/^(\d{2}):(\d{2})$/.exec(value);if(!match)return null;const h=Number(match[1]),m=Number(match[2]);return h<24&&m<60?h*60+m:null}
 if(normalized.some((x:any)=>!Number.isInteger(x.dayOfWeek)||x.dayOfWeek<0||x.dayOfWeek>6||minutes(x.startTime)===null||minutes(x.endTime)===null||minutes(x.endTime)!<=minutes(x.startTime)!))return NextResponse.json({error:"Availability must use real times with an end after the start."},{status:400})
 const enabled=normalized.filter((x:any)=>x.enabled).sort((a:any,b:any)=>a.dayOfWeek-b.dayOfWeek||minutes(a.startTime)!-minutes(b.startTime)!)
 if(enabled.some((rule:any,index:number)=>index>0&&enabled[index-1].dayOfWeek===rule.dayOfWeek&&minutes(rule.startTime)!<minutes(enabled[index-1].endTime)!))return NextResponse.json({error:"Availability rules cannot overlap."},{status:400})
 await db.$transaction([
  db.serviceAvailability.deleteMany({where:{serviceId:id}}),
  ...enabled.map((x:any)=>db.serviceAvailability.create({data:{...x,serviceId:id}})),
 ])
 const result=await db.serviceAvailability.findMany({where:{serviceId:id},orderBy:[{dayOfWeek:"asc"},{startTime:"asc"}]})
 return NextResponse.json(result)
}
