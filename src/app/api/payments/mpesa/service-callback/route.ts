import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { notifyServiceBooking, notifyStaff } from "@/lib/notify"

export async function POST(request:Request){
 try{
  const body=await request.json().catch(()=>({}))
  const callback=body?.Body?.stkCallback
  const checkoutRequestId=String(callback?.CheckoutRequestID||body.checkoutRequestId||"")
  if(!checkoutRequestId)return NextResponse.json({error:"CheckoutRequestID is required."},{status:400})
  const success=callback ? Number(callback.ResultCode)===0 : body.result==="SUCCESS"
  const items=Array.isArray(callback?.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item : []
  const receipt=items.find((i:any)=>i.Name==="MpesaReceiptNumber")?.Value
  const payment=await db.servicePayment.findFirst({where:{checkoutRequestId},orderBy:{createdAt:"desc"},include:{booking:{include:{service:true,user:true}}}})
  if(!payment)return NextResponse.json({error:"Service payment not found."},{status:404})
  if(payment.status==="SUCCESS")return NextResponse.json({ok:true,status:"SUCCESS"})
  if(success){
   const providerReference=String(receipt||("MP-"+Date.now()))
   await db.servicePayment.update({where:{id:payment.id},data:{status:"SUCCESS",providerReference}})
   await db.serviceBooking.update({where:{id:payment.bookingId},data:{paymentStatus:"PAID"}})
   await notifyServiceBooking({userId:payment.booking.userId,customerName:payment.booking.user.name,customerEmail:payment.booking.user.email,reference:payment.booking.reference,serviceName:payment.booking.service.name,status:"Payment received",message:"Payment of KSh "+payment.amount.toLocaleString()+" for your "+payment.booking.service.name+" booking was received successfully.",start:payment.booking.scheduledStart,end:payment.booking.scheduledEnd,bookingId:payment.bookingId,event:"SERVICE_PAYMENT_SUCCESS"})
   await notifyStaff({roles:["ADMIN","PHARMACIST","STAFF"],event:"SERVICE_PAYMENT_RECEIVED",title:"Service payment received: "+payment.booking.reference,message:"KSh "+payment.amount.toLocaleString()+" received for "+payment.booking.service.name+".",link:(process.env.NEXT_PUBLIC_APP_URL||"https://spherepharmacy.co.ke")+"/#admin",metadata:{bookingId:payment.bookingId,reference:payment.booking.reference,providerReference}})
   return NextResponse.json({ok:true,status:"SUCCESS",providerReference})
  }
  await db.servicePayment.update({where:{id:payment.id},data:{status:"FAILED",failureReason:String(callback?.ResultDesc||"M-Pesa payment was cancelled or rejected")}})
  return NextResponse.json({ok:true,status:"FAILED"})
 }catch(err){console.error("[Service M-Pesa callback]",err);return NextResponse.json({error:"Could not process service payment callback."},{status:500})}
}
