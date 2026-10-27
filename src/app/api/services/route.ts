import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { managedImage, validateServiceFields } from "@/lib/security/service"

function dto(service:any){return {...service,createdAt:service.createdAt.toISOString(),updatedAt:service.updatedAt.toISOString()}}
function canManage(session:any){return Boolean(session?.staffId&&["ADMIN","PHARMACIST","STAFF"].includes(session.staffRole))}
function slugify(v:string){return v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)}

export async function GET(request:Request){
 const session=await getSession()
 const includeInactive=new URL(request.url).searchParams.get("includeInactive")==="true"
 const list = await db.service.findMany({
    where: includeInactive && canManage(session) ? {} : { active: true },
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  })
 return NextResponse.json(list.map(dto))
}

export async function POST(request:Request){
 const session=await getSession()
 if(!canManage(session))return NextResponse.json({error:"Staff access required."},{status:403})
 const body=await request.json()
 const validated=validateServiceFields(body,false)
 if(validated.error)return NextResponse.json({error:validated.error},{status:400})
 if(body.images!==undefined&&(!Array.isArray(body.images)||body.images.length>10||body.images.some((image:any)=>!managedImage(image?.url||image))))return NextResponse.json({error:"Every service image must be an owned upload or site image (up to 10)."}, {status:400})
 const images:Array<{url:string;storageKey:string|null;alt:string|null;sortOrder:number}>=Array.isArray(body.images)
   ?body.images.map((image:any,i:number)=>({
     url:managedImage(image.url||image)!,
     storageKey:typeof image.storageKey==="string"?image.storageKey:null,
     alt:typeof image.alt==="string"?image.alt.slice(0,240):null,
     sortOrder:i,
   }))
   :[]
 const name=String(validated.data.name)
 let slug=slugify(String(body.slug||name))
 if(await db.service.findUnique({where:{slug}}))slug=slug+"-"+Date.now().toString(36)
 const service=await db.service.create({
   data:{...validated.data,name,slug,images:{create:images}},
   include:{images:{orderBy:{sortOrder:"asc"}}},
 })
 return NextResponse.json(dto(service),{status:201})
}
