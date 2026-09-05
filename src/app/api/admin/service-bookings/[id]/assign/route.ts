import { notifyStaff } from "@/lib/notify"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/session"

function can(s:any){return Boolean(s?.staffId&&["ADMIN","PHARMACIST","STAFF"].includes(s.staffRole))}
export async function PATCH(request:Request,ctx:{params:Promise<{id:string}>}){
 const s=await getSession(); if(!can(s))return NextResponse.json({error:"Staff access required."},{status:403})
 const {id}=await ctx.params; const body=await request.json(); const staffId=body.staffId?String(body.staffId):null
 const booking=await db.serviceBooking.findUnique({where:{id}}); if(!booking)return NextResponse.json({error:"Booking not found."},{status:404})
 if(staffId){const staff=await db.staffUser.findUnique({where:{id:staffId}});if(!staff||!staff.active||!["ADMIN","PHARMACIST","STAFF"].includes(staff.role))return NextResponse.json({error:"Invalid staff member."},{status:400})}
 const updated=await db.serviceBooking.update({where:{id},data:{assignedStaffId:staffId}})
 if(staffId && staffId !== booking.assignedStaffId) await notifyStaff({staffId,event:"SERVICE_ASSIGNED",title:"Appointment assigned to you",message:`Appointment ${booking.reference} has been assigned to you. Review the schedule and details in your dashboard.`,link:"/admin/services"})
 return NextResponse.json({ok:true,assignedStaffId:updated.assignedStaffId})
}
