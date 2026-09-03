import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

function staff(session:any){return Boolean(session?.staffId&&["ADMIN","PHARMACIST","STAFF"].includes(session.role))}

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
 const normalized=body.availability.map((x:any)=>({dayOfWeek:Number(x.dayOfWeek),startTime:String(x.startTime),endTime:String(x.endTime),enabled:Boolean(x.enabled)}))
 if(normalized.some((x:any)=>x.dayOfWeek<0||x.dayOfWeek>6||!/^\d{2}:\d{2}$/.test(x.startTime)||!/^\d{2}:\d{2}$/.test(x.endTime)))return NextResponse.json({error:"Invalid availability rule."},{status:400})
 await db.$transaction([
  db.serviceAvailability.deleteMany({where:{serviceId:id}}),
  ...normalized.filter((x:any)=>x.enabled).map((x:any)=>db.serviceAvailability.create({data:{...x,serviceId:id}})),
 ])
 const result=await db.serviceAvailability.findMany({where:{serviceId:id},orderBy:[{dayOfWeek:"asc"},{startTime:"asc"}]})
 return NextResponse.json(result)
}
