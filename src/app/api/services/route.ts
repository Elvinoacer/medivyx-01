import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

function dto(service:any){return {...service,createdAt:service.createdAt.toISOString(),updatedAt:service.updatedAt.toISOString()}}
function canManage(session:any){return Boolean(session?.staffId&&["ADMIN","PHARMACIST","STAFF"].includes(session.role))}
function slugify(v:string){return v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)}

export async function GET(request:Request){
 const session=await getSession()
 const includeInactive=new URL(request.url).searchParams.get("includeInactive")==="true"
 const list=await db.service.findMany({where:includeInactive&&canManage(session)?{}:{active:true},include:{images:{orderBy:{sortOrder:"asc"}}},orderBy:[{featured:"desc"},{sortOrder:"asc"},{name:"asc"}]})
 return NextResponse.json(list.map(dto))
}

export async function POST(request:Request){
 const session=await getSession()
 if(!canManage(session))return NextResponse.json({error:"Staff access required."},{status:403})
 const body=await request.json()
 const name=String(body.name||"").trim()
 if(!name)return NextResponse.json({error:"Service name is required."},{status:400})
 let slug=slugify(String(body.slug||name))
 if(await db.service.findUnique({where:{slug}}))slug=slug+"-"+Date.now().toString(36)
 const service=await db.service.create({data:{
  name,slug,shortDescription:body.shortDescription?String(body.shortDescription):null,description:body.description?String(body.description):null,category:body.category?String(body.category):null,
  durationMinutes:Math.max(1,Number(body.durationMinutes)||15),price:body.price===null||body.price===undefined||body.price===""?null:Number(body.price),
  priceLabel:body.priceLabel?String(body.priceLabel):null,heroImage:body.heroImage?String(body.heroImage):null,featured:Boolean(body.featured),active:body.active!==false,sortOrder:Number(body.sortOrder)||0
 },include:{images:{orderBy:{sortOrder:"asc"}}}})
 return NextResponse.json(dto(service),{status:201})
}
