import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"
import { formatDarajaPhone, initiateStkPush } from "@/lib/mpesa/daraja"

export async function POST(request:Request,ctx:{params:Promise<{id:string}>}){
 const s=await getSession(); if(!s?.userId)return NextResponse.json({error:"Sign in required."},{status:401})
 const {id}=await ctx.params; const body=await request.json()
 const booking=await db.serviceBooking.findUnique({where:{id},include:{service:true}})
 if(!booking||booking.userId!==s.userId)return NextResponse.json({error:"Booking not found."},{status:404})
 if(booking.paymentStatus==="PAID")return NextResponse.json({error:"This booking is already paid."},{status:409})
 if(["CANCELLED","REJECTED","COMPLETED"].includes(booking.status))return NextResponse.json({error:"This booking cannot be paid."},{status:409})
 if(!booking.price||booking.price<=0){await db.serviceBooking.update({where:{id},data:{paymentStatus:"PAID"}});return NextResponse.json({paymentId:null,paymentStatus:"PAID"})}
 const phone=formatDarajaPhone(String(body.phone||s.user?.phone||""))
 if(!/^254[71]\d{8}$/.test(phone))return NextResponse.json({error:"Enter a valid Kenyan M-Pesa number."},{status:400})
 await db.servicePayment.updateMany({where:{bookingId:id,status:{in:["PENDING","PROCESSING"]},method:"STK_PUSH"},data:{status:"FAILED",failureReason:"Superseded by a new request"}})
 const stk=await initiateStkPush({phone,amount:booking.price,reference:booking.reference,description:`Service ${booking.reference}`,callbackUrl:`${process.env.NEXT_PUBLIC_APP_URL||"https://spherepharmacy.co.ke"}/api/payments/mpesa/service-callback`})
 const payment=await db.servicePayment.create({data:{bookingId:id,provider:"MPESA",method:"STK_PUSH",status:"PROCESSING",amount:booking.price,phone,checkoutRequestId:stk.checkoutRequestId}})
 return NextResponse.json({paymentId:payment.id,checkoutRequestId:stk.checkoutRequestId,message:stk.customerMessage,simulated:stk.simulated??false})
}
