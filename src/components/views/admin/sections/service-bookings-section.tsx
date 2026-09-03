"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Clock3, Loader2, RefreshCw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { adminServiceBookingsApi, adminApi } from "@/lib/api-client"
import type { ServiceBookingDTO, ServiceBookingStatus, StaffDTO } from "@/lib/types"
import { type SectionProps, SectionError } from "../admin-shared"
import { toast } from "sonner"

const STATUSES: ServiceBookingStatus[] = ["PENDING","CONFIRMED","ARRIVED","IN_PROGRESS","COMPLETED","CANCELLED","NO_SHOW","REJECTED","RESCHEDULED"]
const statusClass = (s:string) => s==="CONFIRMED"||s==="COMPLETED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : s==="CANCELLED"||s==="REJECTED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"

export function ServiceBookingsSection({refreshKey}:SectionProps){
 const [date,setDate]=useState(new Date().toISOString().slice(0,10))
 const [bookings,setBookings]=useState<ServiceBookingDTO[]|null>(null)
 const [error,setError]=useState<string|null>(null)
 const [busy,setBusy]=useState<string|null>(null)
 const [rescheduleFor,setRescheduleFor]=useState<ServiceBookingDTO|null>(null)
 const [newStart,setNewStart]=useState("")
 const [newEnd,setNewEnd]=useState("")
 const [staff,setStaff]=useState<StaffDTO[]>([])
 async function load(){try{setBookings(await adminServiceBookingsApi.list(date));setError(null)}catch(err){setError(err instanceof Error?err.message:"Could not load bookings.")}}
 useEffect(()=>{void load(); adminApi.staff().then(setStaff).catch(()=>{})},[date,refreshKey])
 const summary=useMemo(()=>({pending:(bookings??[]).filter(b=>b.status==="PENDING").length,confirmed:(bookings??[]).filter(b=>b.status==="CONFIRMED").length,total:(bookings??[]).length}),[bookings])
 async function setStatus(b:ServiceBookingDTO,status:ServiceBookingStatus){setBusy(b.id);try{await adminServiceBookingsApi.updateStatus(b.id,status,undefined);toast.success("Booking updated.");await load()}catch(err){toast.error(err instanceof Error?err.message:"Could not update booking.")}finally{setBusy(null)}}
 return <div className="space-y-5">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold">Service bookings</h2><p className="mt-1 text-sm text-muted-foreground">Manage the daily care schedule and move appointments through their workflow.</p></div><div className="flex gap-2"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"/><Button variant="outline" size="icon" onClick={()=>void load()} aria-label="Refresh bookings"><RefreshCw className="h-4 w-4"/></Button></div></div>
  <div className="grid grid-cols-3 gap-3"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-2xl font-bold">{summary.total}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="mt-1 text-2xl font-bold">{summary.pending}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Confirmed</p><p className="mt-1 text-2xl font-bold">{summary.confirmed}</p></CardContent></Card></div>
  {error?<SectionError message={error} onRetry={()=>void load()}/>:bookings===null?<Card><CardContent className="flex items-center justify-center p-10"><Loader2 className="h-5 w-5 animate-spin"/></CardContent></Card>:bookings.length===0?<Card><CardContent className="p-10 text-center"><CalendarDays className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-3 font-semibold">No bookings for this day.</p></CardContent></Card>:
  <div className="space-y-3">{bookings.map(b=><Card key={b.id}><CardContent className="p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{b.serviceName}</h3><Badge className={statusClass(b.status)} variant="outline">{b.status.replaceAll("_"," ")}</Badge><span className="text-xs text-muted-foreground">{b.reference}</span></div><p className="mt-2 text-sm">{b.customerName||"Customer"} <span className="text-muted-foreground">· {b.customerPhone||"No phone"}</span></p><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><Clock3 className="h-3.5 w-3.5"/>{new Date(b.scheduledStart).toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"})}–{new Date(b.scheduledEnd).toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"})}</p>{b.customerNotes?<p className="mt-2 rounded-lg bg-muted p-2 text-xs text-muted-foreground">{b.customerNotes}</p>:null}
 <div className="mt-3 max-w-xs"><Select value={(b as any).assignedStaffId||"unassigned"} onValueChange={async(v)=>{setBusy(b.id);try{await adminServiceBookingsApi.assign(b.id,v==="unassigned"?null:v);toast.success("Staff assignment updated.");await load()}catch(err){toast.error(err instanceof Error?err.message:"Could not assign staff.")}finally{setBusy(null)}}}><SelectTrigger><SelectValue placeholder="Assign staff"/></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{staff.filter(s=>s.active&&["ADMIN","PHARMACIST","STAFF"].includes(s.role)).map(s=><SelectItem key={s.id} value={s.id}>{s.name} · {s.role}</SelectItem>)}</SelectContent></Select></div></div><div className="flex flex-wrap gap-2 lg:max-w-[420px] lg:justify-end">{["PENDING","CONFIRMED","RESCHEDULED"].includes(b.status)?<Button size="sm" variant="outline" onClick={()=>{setRescheduleFor(b);setNewStart(b.scheduledStart.slice(0,16));setNewEnd(b.scheduledEnd.slice(0,16))}} disabled={!!busy}>Reschedule</Button>:null}{b.status==="PENDING"?<Button size="sm" onClick={()=>void setStatus(b,"CONFIRMED")} disabled={!!busy}><Check className="h-3.5 w-3.5"/> Confirm</Button>:null}{b.status==="CONFIRMED"?<Button size="sm" variant="outline" onClick={()=>void setStatus(b,"ARRIVED")} disabled={!!busy}>Mark arrived</Button>:null}{b.status==="ARRIVED"?<Button size="sm" onClick={()=>void setStatus(b,"IN_PROGRESS")} disabled={!!busy}>Start</Button>:null}{b.status==="IN_PROGRESS"?<Button size="sm" onClick={()=>void setStatus(b,"COMPLETED")} disabled={!!busy}>Complete</Button>:null}{["PENDING","CONFIRMED"].includes(b.status)?<Button size="sm" variant="outline" className="text-destructive" onClick={()=>void setStatus(b,"CANCELLED")} disabled={!!busy}><X className="h-3.5 w-3.5"/> Cancel</Button>:null}</div></div></CardContent></Card>)}</div>}
 </div>
}
