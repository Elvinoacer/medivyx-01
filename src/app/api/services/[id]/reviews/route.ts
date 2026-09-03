import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(_request:Request,ctx:{params:Promise<{id:string}>}){
 const {id}=await ctx.params
 const reviews=await db.serviceReview.findMany({where:{booking:{serviceId:id},status:"PUBLISHED"},include:{user:{select:{name:true}}},orderBy:{createdAt:"desc"}})
 const average=reviews.length?reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length:0
 return NextResponse.json({average:Number(average.toFixed(1)),count:reviews.length,reviews:reviews.map(r=>({id:r.id,rating:r.rating,comment:r.comment,authorName:r.user.name?r.user.name.split(" ")[0]+"…":"Customer",createdAt:r.createdAt.toISOString()}))})
}
