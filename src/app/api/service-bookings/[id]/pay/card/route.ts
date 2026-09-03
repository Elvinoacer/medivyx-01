import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { createIntaSendCheckoutSession } from "@/lib/intasend/client"

export async function POST(_request:Request,ctx:{params:Promise<{id:string}>}){
 const s=await getSession(); if(!s?.userId)return NextResponse.json({error:"Sign in required."},{status:401})
 const {id}=await ctx.params
 const booking=await db.serviceBooking.findUnique({where:{id},include:{service:true}})
 if(!booking||booking.userId!==s.userId)return NextResponse.json({error:"Booking not found."},{status:404})
 if(booking.paymentStatus==="PAID")return NextResponse.json({error:"This booking is already paid."},{status:409})
 if(!booking.price||booking.price<=0){await db.serviceBooking.update({where:{id},data:{paymentStatus:"PAID"}});return NextResponse.json({paymentId:null,status:"SUCCESS"})}
 const session=await createIntaSendCheckoutSession({orderId:booking.id,reference:booking.reference,amount:booking.price,customer:{name:s.user?.name||"Customer",email:s.user?.email,phone:s.user?.phone||undefined},redirectUrl:`${process.env.NEXT_PUBLIC_APP_URL||"https://spherepharmacy.co.ke"}/#services`})
 const payment=await db.servicePayment.create({data:{bookingId:id,provider:"INTASEND",method:"CARD",status:"PROCESSING",amount:booking.price,providerReference:session.id}})
 return NextResponse.json({paymentId:payment.id,checkoutUrl:session.url,status:"PROCESSING",simulated:session.simulated??false})
}
