"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Clock3, MessageCircle, Search, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { servicesApi } from "@/lib/api-client"
import { waLink } from "@/lib/constants"
import type { ServiceDTO } from "@/lib/types"
import { useAppStore } from "@/store/use-app-store"

export function ServicesView() {
  const navigate = useAppStore((s) => s.navigate)
  const [services, setServices] = useState<ServiceDTO[] | null>(null)
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    servicesApi.list()
      .then((data) => { if (!cancelled) setServices(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "We could not load our services.") })
    return () => { cancelled = true }
  }, [])

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
           <CardContent className="p-5"><h3 className="text-lg font-bold">{service.name}</h3><p className="mt-2 min-h-12 text-sm leading-5 text-muted-foreground">{service.shortDescription||service.description||"Care service available from Sphere Pharmacy."}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1"><Clock3 className="h-3.5 w-3.5"/> {service.durationMinutes} min</span><span className="rounded-full bg-muted px-2.5 py-1">{service.priceLabel||(service.price!=null?"KSh "+service.price.toLocaleString():"Contact us")}</span></div><div className="mt-5 flex justify-end"><a href={waLink("Hello Sphere Pharmacy! I would like more information about "+service.name+".")} target="_blank" rel="noreferrer"><Button size="sm" className="gap-1.5 rounded-full">Ask about it <ArrowRight className="h-3.5 w-3.5"/></Button></a></div></CardContent>
         </Card>
       ))}</div>}
      <div className="mt-10 rounded-2xl border bg-muted/30 p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Need help choosing a service?</p><p className="mt-1 text-sm text-muted-foreground">Talk to the Sphere Pharmacy team and we will help you choose the right service.</p></div><a href={waLink("Hello Sphere Pharmacy! I need help choosing a service.")} target="_blank" rel="noreferrer"><Button className="rounded-full"><MessageCircle className="h-4 w-4"/> Talk to our team</Button></a></div></div>
    </div>
  )
}
