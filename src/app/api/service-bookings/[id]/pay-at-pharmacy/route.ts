import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function POST(_request:Request,ctx:{params:Promise<{id:string}>}){
 const s=await getSession(); if(!s?.userId)return NextResponse.json({error:"Sign in required."},{status:401})
 const {id}=await ctx.params
 const booking=await db.serviceBooking.findUnique({where:{id}})
 if(!booking||booking.userId!==s.userId)return NextResponse.json({error:"Booking not found."},{status:404})
 if(booking.paymentStatus==="PAID")return NextResponse.json({error:"This booking is already paid."},{status:409})
 if(["CANCELLED","REJECTED","COMPLETED"].includes(booking.status))return NextResponse.json({error:"This booking cannot be paid."},{status:409})
 await db.$transaction([
  db.serviceBooking.update({where:{id},data:{paymentStatus:"PAY_AT_PHARMACY"}}),
  db.servicePayment.upsert({where:{idempotencyKey:`service:${id}:pay-at-pharmacy`},create:{bookingId:id,provider:"IN_STORE",method:"PAY_AT_PHARMACY",status:"PENDING",amount:booking.price||0,currency:"KES",idempotencyKey:`service:${id}:pay-at-pharmacy`},update:{status:"PENDING",failureReason:null}}),
 ])
 return NextResponse.json({ok:true,paymentStatus:"PAY_AT_PHARMACY"})
}
