"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowDownUp, CalendarDays, Camera, Check, CheckCircle2, Copy, Edit3, Grid2X2, ImagePlus, LayoutList, Loader2, MoreHorizontal, Plus, RotateCcw, Search, SlidersHorizontal, Star, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { servicesAdminApi, servicesApi, storageApi } from "@/lib/api-client"
import type { ServiceDTO } from "@/lib/types"
import { AdminSectionHeader, SectionError, type SectionProps } from "../admin-shared"
import { toast } from "sonner"

type GalleryImage={url:string;storageKey?:string|null;alt?:string|null}
type FormState={name:string;shortDescription:string;description:string;category:string;durationMinutes:string;price:string;priceLabel:string;heroImage:string;gallery:GalleryImage[];featured:boolean;active:boolean}
const EMPTY:FormState={name:"",shortDescription:"",description:"",category:"",durationMinutes:"15",price:"",priceLabel:"",heroImage:"",gallery:[],featured:false,active:true}

export function ServicesSection({refreshKey,onRefresh}:SectionProps){
 const [services,setServices]=useState<ServiceDTO[]|null>(null),[error,setError]=useState<string|null>(null),[editing,setEditing]=useState<ServiceDTO|"new"|null>(null),[form,setForm]=useState<FormState>(EMPTY),[saving,setSaving]=useState(false),[uploading,setUploading]=useState(false),[availabilityService,setAvailabilityService]=useState<ServiceDTO|null>(null),[availability,setAvailability]=useState<Record<number,{startTime:string;endTime:string;enabled:boolean}>>({}),[availabilitySaving,setAvailabilitySaving]=useState(false)

 const [search,setSearch]=useState("")
 const [statusFilter,setStatusFilter]=useState<"all"|"live"|"archived">("all")
 const [categoryFilter,setCategoryFilter]=useState("all")
 const [featuredOnly,setFeaturedOnly]=useState(false)
 const [sortBy,setSortBy]=useState<"featured"|"name"|"recent"|"price">("featured")
 const [viewMode,setViewMode]=useState<"list"|"grid">("list")
 const [selectedIds,setSelectedIds]=useState<Set<string>>(new Set())
 const [pendingArchive,setPendingArchive]=useState<ServiceDTO[]|null>(null)
 const [busy,setBusy]=useState(false)
 const [editorTab,setEditorTab]=useState<"details"|"media">("details")
 const fileRef=useRef<HTMLInputElement>(null)
 const load=async()=>{try{setServices(await servicesApi.list(true));setError(null)}catch(err){setError(err instanceof Error?err.message:"Could not load services.")}}
 useEffect(()=>{void load()},[refreshKey])
 const openNew=()=>{setForm({...EMPTY,gallery:[]});setEditorTab("details");setEditing("new")}
 const openAvailability=async(s:ServiceDTO)=>{setAvailabilityService(s);try{const rows=await servicesAdminApi.availability(s.id);const map:Record<number,{startTime:string;endTime:string;enabled:boolean}>={};rows.forEach(r=>{map[r.dayOfWeek]={startTime:r.startTime,endTime:r.endTime,enabled:r.enabled}});setAvailability(map)}catch{setAvailability({})}}
 const saveAvailability=async()=>{if(!availabilityService)return;setAvailabilitySaving(true);try{await servicesAdminApi.saveAvailability(availabilityService.id,Object.entries(availability).map(([day,v])=>({dayOfWeek:Number(day),...v,id:"",serviceId:availabilityService.id})));toast.success("Availability saved.");setAvailabilityService(null)}catch(err){toast.error(err instanceof Error?err.message:"Could not save availability.")}finally{setAvailabilitySaving(false)}}
 const openEdit=(s:ServiceDTO)=>{setForm({name:s.name,shortDescription:s.shortDescription||"",description:s.description||"",category:s.category||"",durationMinutes:String(s.durationMinutes),price:s.price==null?"":String(s.price),priceLabel:s.priceLabel||"",heroImage:s.heroImage||"",gallery:(s.images||[]).filter(i=>i.url!==s.heroImage).map(i=>({url:i.url,storageKey:i.storageKey,alt:i.alt})),featured:s.featured,active:s.active});setEditorTab("details");setEditing(s)}
 async function uploadHero(file:File){setUploading(true);try{const r=await storageApi.uploadFile(file,"services");setForm(f=>({...f,heroImage:r.url}));toast.success("Service image uploaded.")}catch(err){toast.error(err instanceof Error?err.message:"Upload failed.")}finally{setUploading(false);if(fileRef.current)fileRef.current.value=""}}
 async function uploadGallery(files:FileList|null){if(!files?.length)return;setUploading(true);try{const added:GalleryImage[]=[];for(const file of Array.from(files).slice(0,10-form.gallery.length)){const r=await storageApi.uploadFile(file,"services");if(r.url!==form.heroImage)added.push({url:r.url,storageKey:r.key,alt:file.name})}setForm(f=>({...f,gallery:[...f.gallery,...added]}));toast.success(added.length+" gallery image"+(added.length===1?"":"s")+" uploaded.")}catch(err){toast.error(err instanceof Error?err.message:"Gallery upload failed.")}finally{setUploading(false)}}
 async function save(){if(!form.name.trim())return toast.error("Service name is required.");setSaving(true);try{const payload={...form,durationMinutes:Number(form.durationMinutes)||15,price:form.price===""?null:Number(form.price),images:form.gallery};if(editing==="new")await servicesApi.create(payload);else if(editing)await servicesApi.update(editing.id,payload);toast.success(editing==="new"?"Service created.":"Service updated.");setEditing(null);await load();onRefresh()}catch(err){toast.error(err instanceof Error?err.message:"Could not save service.")}finally{setSaving(false)}}

 const categories=useMemo(()=>Array.from(new Set((services||[]).map(s=>s.category?.trim()).filter((s):s is string=>Boolean(s)))).sort((a,b)=>a.localeCompare(b)),[services])
 const counts=useMemo(()=>({total:services?.length||0,live:services?.filter(s=>s.active).length||0,archived:services?.filter(s=>!s.active).length||0,featured:services?.filter(s=>s.featured&&s.active).length||0}),[services])
 const visible=useMemo(()=>{
  const term=search.trim().toLowerCase()
  const list=(services||[]).filter(s=>
   (statusFilter==="all"||(statusFilter==="live"?s.active:!s.active)) &&
   (categoryFilter==="all"||s.category===categoryFilter) &&
   (!featuredOnly||(s.featured&&s.active)) &&
   (!term||[s.name,s.category,s.shortDescription,s.description,s.priceLabel].some(v=>v?.toLowerCase().includes(term)))
  )
  list.sort((a,b)=>{
   if(sortBy==="name")return a.name.localeCompare(b.name)
   if(sortBy==="recent")return b.updatedAt.localeCompare(a.updatedAt)
   if(sortBy==="price")return (a.price??Number.MAX_SAFE_INTEGER)-(b.price??Number.MAX_SAFE_INTEGER)
   return Number(b.featured&&b.active)-Number(a.featured&&a.active)||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name)
  })
  return list
 },[services,search,statusFilter,categoryFilter,featuredOnly,sortBy])
 const visibleIds=visible.map(s=>s.id)
 const allVisibleSelected=visibleIds.length>0&&visibleIds.every(id=>selectedIds.has(id))
 const selectedServices=(services||[]).filter(s=>selectedIds.has(s.id))
 const filtersActive=Boolean(search)||statusFilter!=="all"||categoryFilter!=="all"||featuredOnly
 const clearFilters=()=>{setSearch("");setStatusFilter("all");setCategoryFilter("all");setFeaturedOnly(false)}
 const toggleSelected=(id:string,checked:boolean)=>setSelectedIds(previous=>{const next=new Set(previous);if(checked)next.add(id);else next.delete(id);return next})
 const selectVisible=(checked:boolean)=>setSelectedIds(previous=>{const next=new Set(previous);visibleIds.forEach(id=>checked?next.add(id):next.delete(id));return next})
 const priceFor=(service:ServiceDTO)=>service.priceLabel||(service.price!=null?"KSh "+service.price.toLocaleString("en-KE"):"Ask for price")
 const pictureFor=(service:ServiceDTO)=>service.heroImage||service.images?.[0]?.url||""
 const duplicate=(service:ServiceDTO)=>{
  setForm({
   name:service.name+" (copy)",shortDescription:service.shortDescription||"",description:service.description||"",
   category:service.category||"",durationMinutes:String(service.durationMinutes),price:service.price==null?"":String(service.price),
   priceLabel:service.priceLabel||"",heroImage:service.heroImage||"",
   gallery:(service.images||[]).filter(i=>i.url!==service.heroImage).map(i=>({url:i.url,storageKey:i.storageKey,alt:i.alt})),
   active:false,featured:false
  })
  setEditorTab("details")
  setEditing("new")
 }
 async function changeService(service:ServiceDTO,change:{active?:boolean;featured?:boolean}){
  if(busy)return
  setBusy(true)
  try {
   await servicesApi.update(service.id,change)
   toast.success(change.active===true?"Service is live.":change.featured===true?"Service featured.":change.featured===false?"Featured status removed.":"Service updated.")
   await load();onRefresh()
  }catch(err){toast.error(err instanceof Error?err.message:"Could not update the service.")}
  finally{setBusy(false)}
 }
 async function applyMany(items:ServiceDTO[],action:"archive"|"publish"|"feature"|"unfeature"){
  if(busy||!items.length)return
  setBusy(true)
  let success=0,failed=0
  try{
   for(const service of items){
    if((action==="archive"&&!service.active)||(action==="publish"&&service.active)||(action==="feature"&&service.featured)||(action==="unfeature"&&!service.featured)){success++;continue}
    try {
     if(action==="archive")await servicesApi.remove(service.id)
     else await servicesApi.update(service.id,action==="publish"?{active:true}:{featured:action==="feature"})
     success++
    }catch{failed++}
   }
   if(success)toast.success(success+" service"+(success===1?"":"s")+" updated.")
   if(failed)toast.error(failed+" service"+(failed===1?"":"s")+" could not be updated. Try again.")
   setSelectedIds(new Set())
   setPendingArchive(null)
   await load();onRefresh()
  }finally{setBusy(false)}
 }
 const requestArchive=(service:ServiceDTO)=>setPendingArchive([service])
 function actionsFor(service:ServiceDTO){
  return <DropdownMenu>
   <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={"More actions for "+service.name} disabled={busy}><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
   <DropdownMenuContent align="end" className="w-48">
    <DropdownMenuItem onSelect={()=>openEdit(service)}><Edit3 className="mr-2 h-4 w-4"/> Edit details</DropdownMenuItem>
    <DropdownMenuItem onSelect={()=>void openAvailability(service)}><CalendarDays className="mr-2 h-4 w-4"/> Booking hours</DropdownMenuItem>
    <DropdownMenuItem onSelect={()=>duplicate(service)}><Copy className="mr-2 h-4 w-4"/> Duplicate as draft</DropdownMenuItem>
    <DropdownMenuSeparator/>
    <DropdownMenuItem onSelect={()=>void changeService(service,{featured:!service.featured})}><Star className="mr-2 h-4 w-4"/>{service.featured?"Remove featured":"Mark as featured"}</DropdownMenuItem>
    {service.active
      ?<DropdownMenuItem onSelect={()=>requestArchive(service)} className="text-destructive focus:text-destructive"><Archive className="mr-2 h-4 w-4"/> Archive service</DropdownMenuItem>
      :<DropdownMenuItem onSelect={()=>void changeService(service,{active:true})}><RotateCcw className="mr-2 h-4 w-4"/> Restore to live</DropdownMenuItem>}
   </DropdownMenuContent>
  </DropdownMenu>
 }
 return <div className="space-y-5">

  <AdminSectionHeader title="Care services" subtitle="Your service catalogue, at a glance." action={<Button onClick={openNew} className="gap-2 rounded-xl"><Plus className="h-4 w-4"/> Add service</Button>}/>
  {error?<SectionError message={error} onRetry={()=>void load()}/>:null}
  <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
    <div role="group" aria-label="Filter by publication status" className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/70 p-1">
     {(["all","live","archived"] as const).map(status=><button key={status} type="button" onClick={()=>setStatusFilter(status)} aria-pressed={statusFilter===status} className={"rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary "+(statusFilter===status?"bg-background text-foreground shadow-sm":"text-muted-foreground hover:text-foreground")}>{status==="all"?"All":status==="live"?"Live":"Archived"} <span className="ml-1 tabular-nums opacity-75">{counts[status==="all"?"total":status]}</span></button>)}
    </div>
    <button type="button" aria-pressed={featuredOnly} onClick={()=>setFeaturedOnly(value=>!value)} className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors "+(featuredOnly?"border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200":"text-muted-foreground hover:bg-muted")}><Star className={"h-3.5 w-3.5 "+(featuredOnly?"fill-current":"")}/> Featured <span className="tabular-nums">{counts.featured}</span></button>
   </div>
   <div className="flex flex-col gap-3 p-4 sm:px-5">
    <div className="flex flex-wrap items-center gap-2.5">
     <div className="relative min-w-[190px] flex-[2_1_260px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
      <Input aria-label="Search services" placeholder="Search services, categories, details…" value={search} onChange={event=>setSearch(event.target.value)} className="h-10 rounded-xl pl-9 pr-9"/>
      {search?<button type="button" onClick={()=>setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4"/></button>:null}
     </div>
     <Select value={categoryFilter} onValueChange={setCategoryFilter}>
      <SelectTrigger aria-label="Filter category" className="h-10 min-w-[150px] max-w-[220px] flex-1 rounded-xl"><SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/><SelectValue placeholder="All categories"/></SelectTrigger>
      <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(category=><SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
     </Select>
     <Select value={sortBy} onValueChange={value=>setSortBy(value as typeof sortBy)}>
      <SelectTrigger aria-label="Sort services" className="h-10 min-w-[145px] max-w-[185px] flex-1 rounded-xl"><ArrowDownUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/><SelectValue/></SelectTrigger>
      <SelectContent><SelectItem value="featured">Featured first</SelectItem><SelectItem value="name">Name A–Z</SelectItem><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="price">Lowest price</SelectItem></SelectContent>
     </Select>
     <div role="group" aria-label="Display mode" className="flex h-10 shrink-0 items-center gap-1 rounded-xl border p-1">
      <Button size="icon" variant={viewMode==="list"?"secondary":"ghost"} aria-label="List view" aria-pressed={viewMode==="list"} onClick={()=>setViewMode("list")} className="h-8 w-8 rounded-lg"><LayoutList className="h-4 w-4"/></Button>
      <Button size="icon" variant={viewMode==="grid"?"secondary":"ghost"} aria-label="Grid view" aria-pressed={viewMode==="grid"} onClick={()=>setViewMode("grid")} className="h-8 w-8 rounded-lg"><Grid2X2 className="h-4 w-4"/></Button>
     </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
     <span aria-live="polite">{services===null?"Loading services…":visible.length+" of "+counts.total+" services"}</span>
     {filtersActive?<button type="button" onClick={clearFilters} className="font-semibold text-primary hover:underline">Clear filters</button>:<span>Changes here update the storefront</span>}
    </div>
   </div>
   {selectedIds.size>0&&services!==null?<div className="flex flex-wrap items-center gap-2 border-t bg-primary/[.045] px-4 py-3 sm:px-5">
    <span className="mr-2 text-xs font-semibold">{selectedServices.length} selected</span>
    <Button size="sm" variant="outline" disabled={busy} onClick={()=>void applyMany(selectedServices,"publish")}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/> Publish</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={()=>void applyMany(selectedServices,"feature")}><Star className="mr-1.5 h-3.5 w-3.5"/> Feature</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={()=>void applyMany(selectedServices,"unfeature")}>Unfeature</Button>
    <Button size="sm" variant="outline" disabled={busy} className="text-destructive hover:text-destructive" onClick={()=>setPendingArchive(selectedServices.filter(service=>service.active))} disabled={busy||!selectedServices.some(service=>service.active)}><Archive className="mr-1.5 h-3.5 w-3.5"/> Archive</Button>
    <button type="button" onClick={()=>setSelectedIds(new Set())} className="ml-auto text-xs font-medium text-muted-foreground hover:text-foreground">Clear selection</button>
   </div>:null}
   {services===null?<div className="space-y-2 border-t p-4">{Array.from({length:5}).map((_,i)=><div key={i} className="h-20 animate-pulse rounded-xl bg-muted/50"/>)}</div>
   :services.length===0?<div className="border-t px-6 py-14 text-center"><ImagePlus className="mx-auto h-9 w-9 text-muted-foreground"/><h3 className="mt-3 font-semibold">No care services yet</h3><p className="mt-1 text-sm text-muted-foreground">Create your first service to start taking bookings.</p><Button className="mt-5" onClick={openNew}><Plus className="mr-2 h-4 w-4"/> Create service</Button></div>
   :visible.length===0?<div className="border-t px-6 py-12 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground"/><h3 className="mt-3 font-semibold">No matching services</h3><p className="mt-1 text-sm text-muted-foreground">Try a different search or clear the filters.</p><Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>Reset filters</Button></div>
   :viewMode==="list"?<>
    <div className="hidden items-center gap-3 border-y bg-muted/30 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[32px_minmax(0,1fr)_95px_110px_132px] sm:px-5">
     <Checkbox checked={allVisibleSelected?true:visibleIds.some(id=>selectedIds.has(id))?"indeterminate":false} onCheckedChange={value=>selectVisible(value===true)} aria-label="Select all visible services"/>
     <span>Service</span><span>Status</span><span>Price</span><span className="text-right">Manage</span>
    </div>
    <div className="divide-y">
     {visible.map(service=><div key={service.id} className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/25 sm:px-5 lg:grid lg:grid-cols-[32px_minmax(0,1fr)_95px_110px_132px] lg:gap-3">
      <Checkbox checked={selectedIds.has(service.id)} onCheckedChange={value=>toggleSelected(service.id,value===true)} aria-label={"Select "+service.name}/>
      <div className="flex min-w-0 flex-1 items-center gap-3">
       <div className="relative h-[66px] w-[74px] shrink-0 overflow-hidden rounded-xl border bg-muted">
        {pictureFor(service)?<img src={pictureFor(service)} alt="" loading="lazy" className="h-full w-full object-cover"/>:<div className="grid h-full w-full place-items-center text-muted-foreground"><ImagePlus className="h-5 w-5"/></div>}
       </div>
       <div className="min-w-0 flex-1">
        <button type="button" onClick={()=>openEdit(service)} className="block max-w-full truncate text-left text-sm font-semibold leading-5 text-foreground hover:text-primary hover:underline">{service.name}</button>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{service.category||"Uncategorized"} <span aria-hidden="true">·</span> {service.durationMinutes} min{service.featured?<span className="ml-2 inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"><Star className="h-3 w-3 fill-current"/> Featured</span>:null}</p>
        <p className="mt-1 hidden max-w-[55ch] truncate text-xs text-muted-foreground sm:block">{service.shortDescription||service.description||"No summary added"}</p>
        <div className="mt-1 flex items-center gap-2 text-xs lg:hidden"><span className={service.active?"text-emerald-700 dark:text-emerald-300":"text-muted-foreground"}>{service.active?"Live":"Archived"}</span><span className="text-muted-foreground">·</span><span className="font-semibold text-foreground">{priceFor(service)}</span></div>
       </div>
      </div>
      <div className="hidden lg:block"><Badge variant={service.active?"secondary":"outline"} className={service.active?"border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300":"text-muted-foreground"}>{service.active?"Live":"Archived"}</Badge></div>
      <div className="hidden text-xs font-semibold text-foreground lg:block">{priceFor(service)}</div>
      <div className="flex shrink-0 items-center justify-end gap-1">
       <Button size="sm" variant="outline" className="hidden h-9 gap-1.5 rounded-lg px-2.5 xl:inline-flex" onClick={()=>void openAvailability(service)}><CalendarDays className="h-3.5 w-3.5"/> Hours</Button>
       <Button size="sm" variant="outline" className="h-9 rounded-lg px-2.5" onClick={()=>openEdit(service)}><Edit3 className="h-3.5 w-3.5"/><span className="hidden sm:inline">Edit</span></Button>
       {actionsFor(service)}
      </div>
     </div>)}
    </div>
   </>:<div className="border-t p-3 sm:p-4">
    <div className="mb-3 flex items-center gap-2">
     <Checkbox checked={allVisibleSelected?true:visibleIds.some(id=>selectedIds.has(id))?"indeterminate":false} onCheckedChange={value=>selectVisible(value===true)} aria-label="Select all visible services"/>
     <span className="text-xs text-muted-foreground">Select all shown</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
     {visible.map(service=><div key={service.id} className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="relative h-36 bg-muted">
       {pictureFor(service)?<img src={pictureFor(service)} alt="" loading="lazy" className="h-full w-full object-cover"/>:<div className="grid h-full w-full place-items-center text-muted-foreground"><ImagePlus className="h-8 w-8"/></div>}
       <div className="absolute left-3 top-3 rounded-md bg-background/90 p-1 shadow-sm"><Checkbox checked={selectedIds.has(service.id)} onCheckedChange={value=>toggleSelected(service.id,value===true)} aria-label={"Select "+service.name}/></div>
       <span className={"absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm "+(service.active?"bg-emerald-950 text-white":"bg-background text-foreground")}>{service.active?"Live":"Archived"}</span>
      </div>
      <div className="space-y-2 p-3.5">
       <div className="flex items-start justify-between gap-2"><button type="button" onClick={()=>openEdit(service)} className="line-clamp-2 text-left text-sm font-semibold hover:underline">{service.name}</button><span className="shrink-0 text-xs font-bold">{priceFor(service)}</span></div>
       <p className="truncate text-xs text-muted-foreground">{service.category||"Pharmacy care"} · {service.durationMinutes} min {service.featured?"· Featured":""}</p>
       <div className="flex items-center justify-end gap-1 border-t pt-2">
        <Button variant="outline" size="sm" className="mr-auto h-8 gap-1" onClick={()=>void openAvailability(service)}><CalendarDays className="h-3.5 w-3.5"/> Hours</Button>
        <Button variant="outline" size="sm" className="h-8" onClick={()=>openEdit(service)}>Edit</Button>
        {actionsFor(service)}
       </div>
      </div>
     </div>)}
    </div>
   </div>}
  </div>
  <Dialog open={editing!==null} onOpenChange={open=>!open&&setEditing(null)}><DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing==="new"?"Create a care service":"Edit care service"}</DialogTitle><DialogDescription>These fields drive the customer-facing service catalogue.</DialogDescription></DialogHeader>
   <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="service-name">Service name</Label><Input id="service-name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
    <div className="space-y-2"><Label htmlFor="service-category">Category</Label><Input id="service-category" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/></div><div className="space-y-2"><Label htmlFor="service-duration">Duration (minutes)</Label><Input id="service-duration" type="number" min={1} value={form.durationMinutes} onChange={e=>setForm({...form,durationMinutes:e.target.value})}/></div>
    <div className="space-y-2"><Label htmlFor="service-price">Price</Label><Input id="service-price" type="number" min={0} value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></div><div className="space-y-2"><Label htmlFor="service-display-price">Display price</Label><Input id="service-display-price" value={form.priceLabel} onChange={e=>setForm({...form,priceLabel:e.target.value})}/></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="service-summary">Short description</Label><Input id="service-summary" value={form.shortDescription} onChange={e=>setForm({...form,shortDescription:e.target.value})}/></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor="service-description">Full description</Label><Textarea id="service-description" rows={5} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></div>
    <div className="space-y-3 sm:col-span-2"><Label>Hero image</Label><div className="rounded-2xl border border-dashed p-3">{form.heroImage?<div className="relative overflow-hidden rounded-xl"><img src={form.heroImage} alt="Service preview" className="aspect-[16/9] w-full object-cover"/><Button type="button" size="icon" variant="destructive" aria-label="Remove service hero image" className="absolute right-2 top-2 h-8 w-8" onClick={()=>setForm({...form,heroImage:""})}><X className="h-4 w-4"/></Button></div>:<button type="button" onClick={()=>fileRef.current?.click()} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-10 text-center hover:bg-muted/40"><Camera className="h-8 w-8 text-muted-foreground"/><span className="text-sm font-medium">Upload a service photo</span><span className="text-xs text-muted-foreground">JPG, PNG, WebP or HEIC</span></button>}{form.heroImage?<div className="mt-2 text-center"><Button type="button" size="sm" variant="outline" onClick={()=>fileRef.current?.click()} disabled={uploading}><Upload className="h-3.5 w-3.5"/> Replace image</Button></div>:null}<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadHero(f)}}/></div></div>
    <div className="space-y-3 sm:col-span-2"><div className="flex items-center justify-between"><Label>Gallery images</Label><span className="text-xs text-muted-foreground">{form.gallery.length}/10</span></div><div className="grid grid-cols-3 gap-2">{form.gallery.map((img,i)=><div key={img.url} className="group relative aspect-square overflow-hidden rounded-lg border"><img src={img.url} alt={img.alt||"Service gallery"} className="h-full w-full object-cover"/><Button type="button" size="icon" variant="destructive" aria-label={`Remove gallery image ${i+1}`} className="absolute right-1 top-1 h-7 w-7 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" onClick={()=>setForm(f=>({...f,gallery:f.gallery.filter((_,idx)=>idx!==i)}))}><X className="h-3.5 w-3.5"/></Button></div>)}{form.gallery.length<10?<label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-center hover:bg-muted/40"><ImagePlus className="h-5 w-5 text-muted-foreground"/><span className="text-xs font-medium">Add photos</span><input type="file" accept="image/*" multiple className="hidden" onChange={e=>void uploadGallery(e.target.files)}/></label>:null}</div><p className="text-xs text-muted-foreground">Use clear photos of the service environment, equipment or process.</p></div><div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2"><div><p className="text-sm font-semibold">Show on storefront</p><p className="text-xs text-muted-foreground">Disable without deleting.</p></div><Switch checked={form.active} onCheckedChange={v=>setForm({...form,active:v})}/></div>
    <div className="flex items-center justify-between rounded-xl border p-3 sm:col-span-2"><div><p className="text-sm font-semibold">Feature service</p><p className="text-xs text-muted-foreground">Marks it as a homepage/marketing priority.</p></div><Switch checked={form.featured} onCheckedChange={v=>setForm({...form,featured:v})}/></div>
   </div>
   <DialogFooter><Button variant="outline" onClick={()=>setEditing(null)} disabled={saving}>Cancel</Button><Button onClick={()=>void save()} disabled={saving||uploading}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}{saving?"Saving…":"Save service"}</Button></DialogFooter>
  </DialogContent></Dialog>
 
  <Dialog open={availabilityService!==null} onOpenChange={open=>!open&&setAvailabilityService(null)}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Service availability</DialogTitle><DialogDescription>{availabilityService?.name} — customers can only book within these hours.</DialogDescription></DialogHeader><div className="space-y-2">{["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day,i)=>{const v=availability[i]||{startTime:"09:00",endTime:"17:00",enabled:false};return <div key={day} className="grid grid-cols-[92px_1fr_1fr_auto] items-center gap-2 rounded-xl border p-2"><span className="text-sm font-medium">{day}</span><Input type="time" value={v.startTime} disabled={!v.enabled} onChange={e=>setAvailability({...availability,[i]:{...v,startTime:e.target.value}})}/><Input type="time" value={v.endTime} disabled={!v.enabled} onChange={e=>setAvailability({...availability,[i]:{...v,endTime:e.target.value}})}/><Switch checked={v.enabled} onCheckedChange={on=>setAvailability({...availability,[i]:{...v,enabled:on}})} aria-label={day+" enabled"}/></div>})}</div><DialogFooter><Button variant="outline" onClick={()=>setAvailabilityService(null)} disabled={availabilitySaving}>Cancel</Button><Button onClick={()=>void saveAvailability()} disabled={availabilitySaving}>{availabilitySaving?<Loader2 className="h-4 w-4 animate-spin"/>:<Check className="h-4 w-4"/>}{availabilitySaving?"Saving…":"Save hours"}</Button></DialogFooter></DialogContent></Dialog>

  <AlertDialog open={pendingArchive!==null} onOpenChange={open=>{if(!open&&!busy)setPendingArchive(null)}}>
   <AlertDialogContent className="rounded-2xl sm:max-w-md">
    <AlertDialogHeader>
     <AlertDialogTitle>Archive {pendingArchive?.length===1?"this service":String(pendingArchive?.length||0)+" services"}?</AlertDialogTitle>
     <AlertDialogDescription>Archived services disappear from the customer storefront and cannot receive new bookings. Existing bookings remain intact. You can restore the services at any time.</AlertDialogDescription>
    </AlertDialogHeader>
    {pendingArchive?.length===1?<p className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold">{pendingArchive[0].name}</p>:null}
    <AlertDialogFooter>
     <Button variant="outline" disabled={busy} onClick={()=>setPendingArchive(null)}>Keep services</Button>
     <Button variant="destructive" disabled={busy} onClick={()=>{if(pendingArchive)void applyMany(pendingArchive,"archive")}}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Archive className="mr-2 h-4 w-4"/>} Archive</Button>
    </AlertDialogFooter>
   </AlertDialogContent>
  </AlertDialog>
 </div>
}
