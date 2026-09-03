import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { queryStkPush } from "@/lib/mpesa/daraja"
import { checkIntaSendStatus } from "@/lib/intasend/client"

export async function GET(_request:Request,ctx:{params:Promise<{id:string}>}){
 const s=await getSession(); if(!s?.userId)return NextResponse.json({error:"Sign in required."},{status:401})
 const {id}=await ctx.params
 const booking=await db.serviceBooking.findUnique({where:{id},include:{payments:{orderBy:{createdAt:"desc"}}}})
 if(!booking||booking.userId!==s.userId)return NextResponse.json({error:"Booking not found."},{status:404})
 const payment=booking.payments[0]
 if(!payment)return NextResponse.json({bookingId:id,status:booking.status,paymentStatus:booking.paymentStatus})
 let status=payment.status
 if(status==="PROCESSING"&&payment.provider==="MPESA"&&payment.checkoutRequestId){
   const q=await queryStkPush(payment.checkoutRequestId); status=q.status
   await db.servicePayment.update({where:{id:payment.id},data:{status,failureReason:status==="FAILED"?q.resultDesc:null}})
 } else if(status==="PROCESSING"&&payment.provider==="INTASEND"&&payment.providerReference){
   const q=await checkIntaSendStatus(payment.providerReference); status=q.confirmed?"SUCCESS":"PROCESSING"
   await db.servicePayment.update({where:{id:payment.id},data:{status}})
 }
 if(status==="SUCCESS"&&booking.paymentStatus!=="PAID")await db.serviceBooking.update({where:{id},data:{paymentStatus:"PAID"}})
 return NextResponse.json({bookingId:id,status:booking.status,paymentStatus:status,providerReference:payment.providerReference})
}
