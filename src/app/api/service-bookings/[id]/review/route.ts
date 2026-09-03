import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const s=await getSession(); if(!s?.userId)return NextResponse.json({error:"Sign in required."},{status:401})
 const {id}=await ctx.params; const body=await request.json(); const rating=Number(body.rating)
 if(rating<1||rating>5||!Number.isInteger(rating))return NextResponse.json({error:"Rating must be 1 to 5."},{status:400})
 const booking=await db.serviceBooking.findUnique({where:{id},include:{service:true}})
 if(!booking||booking.userId!==s.userId)return NextResponse.json({error:"Booking not found."},{status:404})
 if(booking.status!=="COMPLETED")return NextResponse.json({error:"You can review a service after it is completed."},{status:409})
 const exists=await db.serviceReview.findUnique({where:{bookingId_userId:{bookingId:id,userId:s.userId}}})
 if(exists)return NextResponse.json({error:"You have already reviewed this booking."},{status:409})
 await db.serviceReview.create({data:{bookingId:id,userId:s.userId,rating,comment:body.comment?String(body.comment).slice(0,1000):null,status:"PUBLISHED",staffId:booking.assignedStaffId}})
 return NextResponse.json({ok:true})
}
