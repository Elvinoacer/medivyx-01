import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function GET(){
 const s=await getSession()
 if(!s?.staffId||!["ADMIN","PHARMACIST","STAFF"].includes(s.role))return NextResponse.json({error:"Staff access required."},{status:403})
 const staff=await db.staffUser.findMany({where:{active:true,role:{in:["ADMIN","PHARMACIST","STAFF"]}},select:{id:true,name:true,email:true,phone:true,role:true,title:true,avatar:true,active:true,createdAt:true},orderBy:{name:"asc"}})
 return NextResponse.json(staff)
}
