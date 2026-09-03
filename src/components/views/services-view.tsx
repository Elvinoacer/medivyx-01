"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Loader2, MessageCircle, Search, ShieldCheck, Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, serviceBookingsApi, servicePaymentsApi, serviceReviewsApi, servicesApi } from "@/lib/api-client"
import { waLink } from "@/lib/constants"
import type { ServiceBookingDTO, ServiceDTO } from "@/lib/types"
import { useAppStore } from "@/store/use-app-store"
import { useAuthStore } from "@/store/use-auth-store"
import { toast } from "sonner"

export function ServicesView() {
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const replace = useAppStore((s) => s.replace)
  const clearAuthIntent = useAppStore((s) => s.clearAuthIntent)
  const params = useAppStore((s) => s.params)
  const session = useAuthStore((s) => s.session)
  const [services, setServices] = useState<ServiceDTO[] | null>(null)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [bookingService, setBookingService] = useState<ServiceDTO | null>(null)
  const [paymentBooking, setPaymentBooking] = useState<ServiceBookingDTO | null>(null)
  const [bookings, setBookings] = useState<ServiceBookingDTO[]>([])
  const [reviewBooking, setReviewBooking] = useState<ServiceBookingDTO | null>(null)
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    servicesApi.list()
      .then((data) => { if (!cancelled) setServices(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "We could not load our services.") })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!session?.user) return
    serviceBookingsApi.mine().then(setBookings).catch(() => {})
  }, [session?.user?.id])

  useEffect(() => {
    const pendingServiceId = params.serviceId
    if (!session?.user || !pendingServiceId || !services) return
    const service = services.find((item) => item.id === pendingServiceId)
    if (!service) return
    setBookingService(service)
    clearAuthIntent()
    replace("services", {})
  }, [session?.user?.id, params.serviceId, services])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (services ?? []).filter((s) => !q || [s.name, s.category, s.shortDescription, s.description].some((v) => v?.toLowerCase().includes(q)))
  }, [services, query])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-16 sm:px-6 lg:px-8">
      <Toaster position="bottom-left" richColors closeButton />
      <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> Sphere Pharmacy Care</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">Healthcare support, not just medicine.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">Explore testing, health checks, consultations and other care services available from our pharmacy team.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button onClick={() => navigate("catalog")} className="rounded-full bg-white px-5 text-teal-950 hover:bg-white/90">Shop medicines <ArrowRight className="h-4 w-4" /></Button>
            <a href={waLink("Hello Sphere Pharmacy! I would like to ask about your care services.")} target="_blank" rel="noreferrer"><Button variant="outline" className="rounded-full border-white/25 bg-white/5 px-5 text-white hover:bg-white/10"><MessageCircle className="h-4 w-4" /> Talk to our team</Button></a>
          </div>
        </div>
      </section>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Available services</p><h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Choose the care you need.</h2></div>
        <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search services..." className="pl-9" /></div>
      </div>
      {services === null && !error ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-72 rounded-2xl" />)}</div> :
       error ? <Card className="mt-6 border-destructive/40"><CardContent className="p-6 text-center text-sm text-muted-foreground">{error}</CardContent></Card> :
       filtered.length === 0 ? <Card className="mt-6"><CardContent className="p-10 text-center text-sm text-muted-foreground">No services match your search.</CardContent></Card> :
       <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((service)=>(
         <Card key={service.id} className="group overflow-hidden rounded-2xl border-border/70 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
           <div className="relative aspect-[16/10] overflow-hidden bg-muted">{service.heroImage?<img src={service.heroImage} alt={service.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy"/>:<div className="flex h-full items-center justify-center"><ShieldCheck className="h-10 w-10 text-muted-foreground/40"/></div>}<div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/25 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">{service.category||"Pharmacy care"}</div></div>
           <CardContent className="p-5"><h3 className="text-lg font-bold">{service.name}</h3><p className="mt-2 min-h-12 text-sm leading-5 text-muted-foreground">{service.shortDescription||service.description||"Care service available from Sphere Pharmacy."}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Clock3 className="h-3.5 w-3.5"/> {service.durationMinutes} min</span><span className="rounded-full bg-muted px-2.5 py-1">{service.priceLabel||(service.price!=null?"KSh "+service.price.toLocaleString():"Contact us")}</span></div><div className="mt-5 flex items-center justify-between gap-2"><a href={waLink("Hello Sphere Pharmacy! I would like more information about "+service.name+".")} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="rounded-full">Ask</Button></a><Button size="sm" className="gap-1.5 rounded-full" onClick={() => { if (!session?.user) { openAuth("login", "services", "Sign in to book this service. You will come straight back to your booking.", { serviceId: service.id }); return } setBookingService(service) }}><CalendarDays className="h-3.5 w-3.5"/> Book</Button></div></CardContent>
         </Card>
       ))}</div>}
      {bookings.length > 0 ? <section className="mt-12"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Your bookings</p><h2 className="mt-1 text-2xl font-bold">Upcoming & recent care</h2></div><div className="grid gap-3 lg:grid-cols-2">{bookings.slice(0,6).map((b) => <Card key={b.id}><CardContent className="flex flex-col gap-3 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{b.serviceName}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(b.scheduledStart).toLocaleString("en-KE",{dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Nairobi"})}</p><p className="mt-1 text-xs text-muted-foreground">{b.reference}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{b.status.replaceAll("_"," ")}</span></div><div className="flex flex-wrap justify-end gap-2">{b.price && b.price>0 && b.paymentStatus!=="PAID" && b.status!=="CANCELLED" && b.status!=="REJECTED" ? <Button size="sm" variant="outline" className="rounded-full" onClick={()=>setPaymentBooking(b)}>Pay now</Button> : null}{b.status==="COMPLETED" && !reviewedIds.has(b.id) ? <Button size="sm" variant="outline" className="rounded-full" onClick={()=>setReviewBooking(b)}><Star className="h-3.5 w-3.5"/> Review</Button> : null}</div></CardContent></Card>)}</div></section> : null}
      <div className="mt-10 rounded-2xl border bg-muted/30 p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Need help choosing a service?</p><p className="mt-1 text-sm text-muted-foreground">Talk to the Sphere Pharmacy team and we will help you choose the right service.</p></div><a href={waLink("Hello Sphere Pharmacy! I need help choosing a service.")} target="_blank" rel="noreferrer"><Button className="rounded-full"><MessageCircle className="h-4 w-4"/> Talk to our team</Button></a></div></div>
      {reviewBooking ? <ServiceReviewDialog booking={reviewBooking} onClose={() => setReviewBooking(null)} onSubmitted={() => { setReviewedIds(prev => new Set(prev).add(reviewBooking.id)); setReviewBooking(null) }} /> : null}
      {paymentBooking ? <ServicePaymentDialog booking={paymentBooking} onClose={() => setPaymentBooking(null)} onPaid={() => { setBookings(prev => prev.map(b => b.id===paymentBooking.id ? { ...b, paymentStatus: "PAID" } : b)); setPaymentBooking(null) }} /> : null}
      {bookingService ? <BookingDialog service={bookingService} onClose={() => setBookingService(null)} onCreated={(b) => { setBookings((prev) => [b, ...prev]); setBookingService(null); if (b.price && b.price > 0) setPaymentBooking(b) }} /> : null}
    </div>
  )
}

function ServiceReviewDialog({ booking, onClose, onSubmitted }: { booking: ServiceBookingDTO; onClose: () => void; onSubmitted: () => void }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    if (!rating) { setError("Please choose a rating."); return }
    setBusy(true); setError(null)
    try { await serviceReviewsApi.create(booking.id, rating, comment.trim() || undefined); toast.success("Thank you for reviewing this service."); onSubmitted() }
    catch (err) { setError(err instanceof Error ? err.message : "Could not submit your review.") }
    finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={(open)=>!open&&onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Review {booking.serviceName}</DialogTitle><DialogDescription>Tell us how your completed visit went.</DialogDescription></DialogHeader><div className="space-y-5"><div className="flex justify-center gap-1.5">{[1,2,3,4,5].map((value)=><button key={value} type="button" onClick={()=>setRating(value)} aria-label={value+" stars"} className="rounded-full p-1.5"><Star className={value<=rating?"h-8 w-8 fill-current text-amber-500":"h-8 w-8 text-muted-foreground/40"}/></button>)}</div><Textarea rows={5} value={comment} onChange={e=>setComment(e.target.value)} placeholder="What did you like about the service? How could we improve?"/>{error?<p className="text-sm text-destructive">{error}</p>:null}</div><DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={()=>void submit()} disabled={busy||!rating}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Star className="h-4 w-4"/>}{busy?"Submitting…":"Submit review"}</Button></DialogFooter></DialogContent></Dialog>
}

function ServicePaymentDialog({ booking, onClose, onPaid }: { booking: ServiceBookingDTO; onClose: () => void; onPaid: () => void }) {
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  async function payMpesa() {
    setBusy(true); setMessage(null)
    try {
      const res = await servicePaymentsApi.mpesa(booking.id, phone)
      setMessage(res.message + " You can close this window after authorising the prompt.")
      const poll = window.setInterval(async () => {
        try {
          const status = await servicePaymentsApi.status(booking.id)
          if (status.paymentStatus === "SUCCESS") { window.clearInterval(poll); setPaid(true); setBusy(false); onPaid() }
        } catch {}
      }, 3000)
      window.setTimeout(() => { window.clearInterval(poll); setBusy(false) }, 120000)
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not start M-Pesa payment."); setBusy(false) }
  }
  async function payCard() {
    setBusy(true); setMessage(null)
    try { const res = await servicePaymentsApi.card(booking.id); window.location.href = res.checkoutUrl }
    catch (err) { setMessage(err instanceof Error ? err.message : "Could not start card payment."); setBusy(false) }
  }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Complete service payment</DialogTitle><DialogDescription>{booking.serviceName} · KSh {(booking.price || 0).toLocaleString()}</DialogDescription></DialogHeader>{paid ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800"><CheckCircle2 className="mx-auto h-10 w-10" /><p className="mt-2 font-bold">Payment received</p><p className="mt-1 text-sm">Your booking remains confirmed with reference {booking.reference}.</p></div> : <div className="space-y-5"><div className="rounded-xl bg-muted/50 p-4"><p className="text-sm font-semibold">Choose how to pay</p><p className="mt-1 text-xs text-muted-foreground">You can also choose to pay when you arrive.</p></div><div><label className="text-sm font-semibold">M-Pesa number</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" className="mt-2" /></div><div className="grid gap-2 sm:grid-cols-2"><Button onClick={() => void payMpesa()} disabled={busy || !phone}>Pay with M-Pesa</Button><Button variant="outline" onClick={() => void payCard()} disabled={busy}>Pay by card</Button></div><Button variant="ghost" className="w-full" onClick={async () => { setBusy(true); try { await servicePaymentsApi.payAtPharmacy(booking.id); onClose() } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save payment preference.") } finally { setBusy(false) } }}>Pay at pharmacy</Button>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}</div>}<DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>Close</Button></DialogFooter></DialogContent></Dialog>
}

function BookingDialog({ service, onClose, onCreated }: { service: ServiceDTO; onClose: () => void; onCreated: (booking: import("@/lib/types").ServiceBookingDTO) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [slots, setSlots] = useState<import("@/lib/types").ServiceSlotDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<import("@/lib/types").ServiceSlotDTO | null>(null)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { setSelected(null); setLoading(true); serviceBookingsApi.slots(service.id,date).then(setSlots).catch(()=>setSlots([])).finally(()=>setLoading(false)) }, [service.id,date])
  const openAuth = useAppStore((s) => s.openAuth)
  async function submit(){ if(!selected)return; setSaving(true); setMessage(null); try { const b=await serviceBookingsApi.create({serviceId:service.id,start:selected.start,end:selected.end,customerNotes:notes}); onCreated(b) } catch(err) { if (err instanceof ApiError && err.status === 401) { openAuth("login", "services", "Sign in to book a service."); return } setMessage(err instanceof Error ? err.message : "Could not create booking.") } finally { setSaving(false) } }
  return <Dialog open onOpenChange={(open)=>!open&&onClose()}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Book {service.name}</DialogTitle><DialogDescription>Choose a day and an available time. Your booking will be held pending pharmacy confirmation.</DialogDescription></DialogHeader><div className="space-y-5"><div><label className="text-sm font-semibold">Date</label><Input type="date" min={new Date().toISOString().slice(0,10)} value={date} onChange={e=>setDate(e.target.value)} className="mt-2"/></div><div><p className="text-sm font-semibold">Available times</p>{loading?<div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Checking availability…</div>:slots.length===0?<div className="mt-3 rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No slots are available on this date. Try another day.</div>:<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map(slot=><Button key={slot.start} type="button" variant={selected?.start===slot.start?"default":"outline"} onClick={()=>setSelected(slot)}>{slot.label}</Button>)}</div>}</div><div><label className="text-sm font-semibold">Notes <span className="font-normal text-muted-foreground">(optional)</span></label><Textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything the pharmacy team should know?" className="mt-2"/></div>{message?<p className="text-sm text-destructive">{message}</p>:null}<div className="rounded-xl bg-muted/50 p-3 text-sm"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4"/> {service.durationMinutes} minutes</div><div className="mt-1 flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> {selected ? new Date(selected.start).toLocaleTimeString("en-KE",{hour:"numeric",minute:"2-digit",timeZone:"Africa/Nairobi"}) : "Select a time"}</div></div></div><DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={()=>void submit()} disabled={!selected||saving}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<CalendarDays className="h-4 w-4"/>}{saving?"Booking…":"Confirm booking"}</Button></DialogFooter></DialogContent></Dialog>
}

