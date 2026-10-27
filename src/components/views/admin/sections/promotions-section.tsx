"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight, CalendarDays, Check, ChevronDown, Copy, Edit3, Gift, Loader2,
  Megaphone, MoreHorizontal, Pause, Plus, RefreshCw, RotateCcw, Search, Share2,
  ShieldCheck, Sparkles, Ticket, Trash2, WandSparkles, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { promotionsApi } from "@/lib/api-client"
import type { PromotionDTO } from "@/lib/types"
import { AdminSectionHeader, apiErrorMessage, type SectionProps } from "../admin-shared"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const COLORS = ["teal","emerald","amber","orange","rose","violet","neutral"] as const
type ColorPreset = typeof COLORS[number]
type Filter = "all"|"live"|"scheduled"|"expired"|"paused"
type FormKey = keyof PromoForm

const themeBg:Record<ColorPreset,string>={
  teal:"bg-teal-700 text-white",emerald:"bg-emerald-700 text-white",
  amber:"bg-amber-400 text-amber-950",orange:"bg-orange-600 text-white",
  rose:"bg-rose-700 text-white",violet:"bg-violet-700 text-white",
  neutral:"bg-slate-700 text-white",
}
const themeDot:Record<ColorPreset,string>={
  teal:"bg-teal-600",emerald:"bg-emerald-600",amber:"bg-amber-400",
  orange:"bg-orange-600",rose:"bg-rose-600",violet:"bg-violet-600",neutral:"bg-slate-700",
}
const fmt=(iso:string|null|undefined)=>iso?new Date(iso).toLocaleDateString("en-KE",{timeZone:"Africa/Nairobi",day:"numeric",month:"short",year:"numeric"}):"—"
const dateOnly=(iso:string|null|undefined)=>{
  if(!iso)return ""
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Nairobi",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(iso))
  const get=(part:string)=>parts.find(x=>x.type===part)?.value||""
  return [get("year"),get("month"),get("day")].join("-")
}
const statusOf=(p:PromotionDTO):Filter=>{
  if(!p.active)return "paused"
  const now=Date.now()
  if(p.startsAt && new Date(p.startsAt).getTime()>now)return "scheduled"
  if(p.endsAt && new Date(p.endsAt).getTime()<now)return "expired"
  return "live"
}
const statusLabel:Record<Filter,string>={all:"All",live:"Live",scheduled:"Scheduled",expired:"Expired",paused:"Paused"}
const statusTone:Record<Exclude<Filter,"all">,string>={
  live:"border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  scheduled:"border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  expired:"border-muted-foreground/20 bg-muted text-muted-foreground",
  paused:"border-muted-foreground/20 bg-muted text-muted-foreground",
}
async function copyText(value:string){
  try{await navigator.clipboard.writeText(value);toast.success("Copied to clipboard.")}
  catch{toast.error("Couldn't copy. Please copy the text manually.")}
}
function shareLink(code:string){return window.location.origin+"/checkout?promo="+encodeURIComponent(code)}
const asInt=(n:number|null|undefined)=>n==null?"":String(n)
const blank = ():PromoForm=>({
  title:"",description:"",badge:"",code:"",discountPct:"",color:"teal",active:true,
  startsAt:"",endsAt:"",minimumSpend:"",maxUses:"",perUserLimit:"2",
  perIpLimit:"",perBrowserLimit:"2",
})
interface PromoForm {
  title:string;description:string;badge:string;code:string;discountPct:string;
  color:ColorPreset;active:boolean;startsAt:string;endsAt:string;
  minimumSpend:string;maxUses:string;perUserLimit:string;perIpLimit:string;perBrowserLimit:string
}
function fromPromo(p?:PromotionDTO):PromoForm{
  if(!p)return blank()
  return {
    title:p.title,description:p.description,badge:p.badge||"",code:p.code||"",
    discountPct:asInt(p.discountPct),color:(COLORS as readonly string[]).includes(p.color||"")?p.color as ColorPreset:"teal",
    active:p.active,startsAt:dateOnly(p.startsAt),endsAt:dateOnly(p.endsAt),
    minimumSpend:asInt(p.minimumSpend),maxUses:asInt(p.maxUses),
    perUserLimit:asInt(p.perUserLimit),perIpLimit:asInt(p.perIpLimit),perBrowserLimit:asInt(p.perBrowserLimit),
  }
}

export function PromotionsSection({refreshKey,onRefresh}:SectionProps){
 const [promos,setPromos]=useState<PromotionDTO[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState<string|null>(null)
 const [search,setSearch]=useState("")
 const [filter,setFilter]=useState<Filter>("all")
 const [editor,setEditor]=useState<{mode:"create"|"edit";promo?:PromotionDTO}|null>(null)
 const [removeFor,setRemoveFor]=useState<PromotionDTO|null>(null)
 const [busyId,setBusyId]=useState<string|null>(null)
 const load=useCallback(async()=>{
  setLoading(true)
  try{setPromos(await promotionsApi.list(true));setError(null)}
  catch(e){setError(apiErrorMessage(e))}
  finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load,refreshKey])
 const counts=useMemo(()=>({
  all:promos.length,
  live:promos.filter(x=>statusOf(x)==="live").length,
  scheduled:promos.filter(x=>statusOf(x)==="scheduled").length,
  expired:promos.filter(x=>statusOf(x)==="expired").length,
  paused:promos.filter(x=>statusOf(x)==="paused").length,
 }),[promos])
 const visible=useMemo(()=>promos.filter(p=>(filter==="all"||statusOf(p)===filter)&&(
  !search.trim() || [p.title,p.description,p.code,p.badge].some(v=>v?.toLowerCase().includes(search.trim().toLowerCase()))
 )),[promos,filter,search])
 async function update(id:string,payload:Partial<PromotionDTO>,message:string){
  setBusyId(id)
  try{await promotionsApi.update(id,payload);toast.success(message);await load();onRefresh()}
  catch(err){toast.error(apiErrorMessage(err))}
  finally{setBusyId(null)}
 }
 return <div className="space-y-5">
  <AdminSectionHeader title="Promotions" subtitle="Publish offers, manage codes and control how often they can be redeemed."
    action={<Button className="gap-2 rounded-xl" onClick={()=>setEditor({mode:"create"})}><Plus className="h-4 w-4"/> New promotion</Button>}/>
  {error?<div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
   <p className="font-semibold">Promotions couldn't be loaded</p><p className="mt-1">{error}</p>
   <Button variant="outline" size="sm" className="mt-3" onClick={()=>void load()}>Retry</Button>
  </div>:null}
  <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Promotion catalogue">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
    <div className="flex max-w-full flex-wrap gap-1 rounded-xl bg-muted/70 p-1" role="group" aria-label="Promotion status">
     {(["all","live","scheduled","expired","paused"] as const).map(s=><button type="button" key={s} onClick={()=>setFilter(s)} aria-pressed={filter===s}
      className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",filter===s?"bg-background shadow-sm":"text-muted-foreground hover:text-foreground")}>
      {statusLabel[s]} <span className="ml-1 tabular-nums opacity-75">{counts[s]}</span>
     </button>)}
    </div>
    <Button size="sm" variant="ghost" disabled={loading} onClick={()=>void load()}><RefreshCw className={cn("mr-2 h-3.5 w-3.5",loading&&"animate-spin")}/> Refresh</Button>
   </div>
   <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
    <div className="relative min-w-[230px] flex-1">
     <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
     <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a promotion or code…" aria-label="Search promotions" className="h-10 rounded-xl pl-9 pr-9"/>
     {search?<button type="button" aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground" onClick={()=>setSearch("")}><X className="h-4 w-4"/></button>:null}
    </div>
    <span className="text-xs text-muted-foreground">{visible.length} of {promos.length} promotions</span>
   </div>
   {loading&&!promos.length?<div className="space-y-2 p-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 animate-pulse rounded-xl bg-muted/70"/>)}</div>
   :!visible.length?<div className="px-4 py-14 text-center">
     <Megaphone className="mx-auto h-9 w-9 text-muted-foreground"/>
     <h3 className="mt-3 font-semibold">{promos.length?"No matching promotions":"No promotions created yet"}</h3>
     <p className="mt-1 text-sm text-muted-foreground">{promos.length?"Change the search or status filter.":"Create an offer banner or a redeemable discount code."}</p>
     <Button className="mt-4" variant="outline" onClick={()=>promos.length?(setSearch(""),setFilter("all")):setEditor({mode:"create"})}>{promos.length?"Clear filters":"Create a promotion"}</Button>
    </div>
   :<div className="divide-y">
    {visible.map(p=>{
     const color= (COLORS as readonly string[]).includes(p.color||"")?p.color as ColorPreset:"teal"
     const st=statusOf(p)
     const count=p.usageCount??0
     return <div key={p.id} className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/20 sm:px-5 lg:flex-row lg:items-center">
      <div className={cn("hidden h-[66px] w-[82px] shrink-0 items-center justify-center rounded-xl sm:flex",themeBg[color])}><Gift className="h-6 w-6"/></div>
      <div className="min-w-0 flex-1">
       <div className="flex flex-wrap items-center gap-2">
        <button onClick={()=>setEditor({mode:"edit",promo:p})} className="max-w-full truncate text-left text-sm font-semibold hover:underline">{p.title}</button>
        <Badge variant="outline" className={statusTone[st]}>{statusLabel[st]}</Badge>
        {p.code?<Badge variant="secondary" className="font-medium">Checkout code</Badge>:<Badge variant="outline">Banner only</Badge>}
       </div>
       <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{p.description}</p>
       <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5"/>{p.startsAt?fmt(p.startsAt):"Any start"} – {p.endsAt?fmt(p.endsAt):"No end"}</span>
        {p.code?<span className="font-semibold tabular-nums text-foreground">{count}{p.maxUses!=null?"/"+p.maxUses:""} redeemed</span>:null}
        {p.minimumSpend!=null?<span>Min KSh {p.minimumSpend.toLocaleString("en-KE")}</span>:null}
       </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
       {p.code?<div className="inline-flex items-center gap-1 rounded-lg border bg-muted/30 px-2 py-1">
        <span className="max-w-[120px] truncate font-mono text-xs font-bold tracking-wide" title={p.code}>{p.code}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={"Copy "+p.code} onClick={()=>void copyText(p.code!)}><Copy className="h-3.5 w-3.5"/></Button>
       </div>:null}
       <Switch checked={p.active} disabled={busyId!==null} aria-label={(p.active?"Pause ":"Enable ")+p.title} onCheckedChange={v=>void update(p.id,{active:v},v?"Promotion enabled.":"Promotion paused.")}/>
       <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={()=>setEditor({mode:"edit",promo:p})}><Edit3 className="h-3.5 w-3.5"/> Edit</Button>
       <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={"More actions for "+p.title} className="h-9 w-9"><MoreHorizontal className="h-4 w-4"/></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
         {p.code?<><DropdownMenuItem onSelect={()=>void copyText(shareLink(p.code!))}><Share2 className="mr-2 h-4 w-4"/> Copy customer link</DropdownMenuItem>
          <DropdownMenuItem onSelect={()=>void copyText(p.code!)}><Ticket className="mr-2 h-4 w-4"/> Copy code</DropdownMenuItem><DropdownMenuSeparator/></>:null}
         <DropdownMenuItem onSelect={()=>void update(p.id,{active:!p.active},p.active?"Promotion paused.":"Promotion enabled.")}>{p.active?<Pause className="mr-2 h-4 w-4"/>:<RotateCcw className="mr-2 h-4 w-4"/>}{p.active?"Pause":"Enable"}</DropdownMenuItem>
         <DropdownMenuItem onSelect={()=>setRemoveFor(p)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Remove</DropdownMenuItem>
        </DropdownMenuContent>
       </DropdownMenu>
      </div>
     </div>
    })}
   </div>}
  </section>
  <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
   Codes can be shared via a checkout link. Limits are enforced at redemption, not merely by hiding an offer. A banner without a code is informational and does not automatically discount an order.</p>
  {editor?<PromotionEditorDialog key={editor.promo?.id||"new"} mode={editor.mode} promo={editor.promo}
   onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);await load();onRefresh()}}/>:null}
  {removeFor?<Dialog open onOpenChange={open=>!open&&!busyId&&setRemoveFor(null)}>
   <DialogContent className="rounded-2xl sm:max-w-md">
    <DialogHeader><DialogTitle>Remove this promotion?</DialogTitle><DialogDescription>
     “{removeFor.title}” will be removed if unused. Promotions with redemptions are paused instead, retaining the history needed for audit and usage limits.
    </DialogDescription></DialogHeader>
    <DialogFooter><Button variant="outline" disabled={!!busyId} onClick={()=>setRemoveFor(null)}>Keep</Button>
     <Button variant="destructive" disabled={!!busyId} onClick={async()=>{
      if(!removeFor)return
      setBusyId(removeFor.id)
      try{
       const result=await promotionsApi.remove(removeFor.id)
       toast.success(result.archived?"Promotion paused; redemption history preserved.":"Promotion deleted.")
       setRemoveFor(null);await load();onRefresh()
      }catch(e){toast.error(apiErrorMessage(e))}
      finally{setBusyId(null)}
     }}>{busyId?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null} Remove</Button>
    </DialogFooter>
   </DialogContent>
  </Dialog>:null}
 </div>
}

function PromotionEditorDialog({mode,promo,onClose,onSaved}:{
 mode:"create"|"edit";promo?:PromotionDTO;onClose:()=>void;onSaved:()=>void|Promise<void>
}){
 const [form,setForm]=useState<PromoForm>(()=>fromPromo(promo))
 const [busy,setBusy]=useState(false)
 const [errors,setErrors]=useState<Partial<Record<FormKey,string>>>({})
 const [serverError,setServerError]=useState<string|null>(null)
 const [showLimits,setShowLimits]=useState(Boolean(promo?.maxUses||promo?.perUserLimit||promo?.perBrowserLimit||promo?.perIpLimit))
 const set=(key:FormKey,value:string|boolean)=>{
  setForm(prev=>({...prev,[key]:value}))
  setErrors(prev=>({...prev,[key]:undefined}))
  setServerError(null)
 }
 function generate(){
  const prefix=form.title.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,5)||"SPHERE"
  const values=new Uint8Array(5)
  crypto.getRandomValues(values)
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const suffix=Array.from(values,x=>alphabet[x%alphabet.length]).join("")
  set("code",prefix+"-"+suffix)
 }
 function validate(){
  const next:Partial<Record<FormKey,string>>={}
  if(form.title.trim().length<3||form.title.trim().length>160)next.title="Use 3–160 characters for the promotion title."
  if(form.description.trim().length<5||form.description.trim().length>2000)next.description="Describe the offer in 5–2,000 characters."
  const code=form.code.trim().toUpperCase()
  if(code&&!/^[A-Z0-9_-]{3,32}$/.test(code))next.code="Use 3–32 letters, numbers, underscores or hyphens."
  if(code&&!form.discountPct)next.discountPct="A checkout code needs a discount percentage."
  if(form.discountPct&&(!Number.isInteger(Number(form.discountPct))||Number(form.discountPct)<1||Number(form.discountPct)>90))next.discountPct="Enter a whole number from 1 to 90."
  for(const field of ["maxUses","perUserLimit","perIpLimit","perBrowserLimit"] as const){
   if(!form[field])continue
   const number=Number(form[field])
   if(!Number.isInteger(number)||number<1||number>1000000)next[field]="Enter a whole number from 1 to 1,000,000."
  }
  if(form.minimumSpend&&(!Number.isFinite(Number(form.minimumSpend))||Number(form.minimumSpend)<0||Number(form.minimumSpend)>10000000))next.minimumSpend="Minimum spend must be KSh 0–10,000,000."
  if(form.startsAt&&form.endsAt&&form.endsAt<form.startsAt)next.endsAt="End date must be on or after the start date."
  setErrors(next)
  return Object.keys(next).length===0
 }
 async function save(){
  if(!validate()){setServerError("Correct the highlighted fields before saving.");return}
  setBusy(true);setServerError(null)
  try{
   const data={
    title:form.title.trim(),description:form.description.trim(),badge:form.badge.trim()||null,
    code:form.code.trim().toUpperCase()||null,
    discountPct:form.discountPct?Number(form.discountPct):null,
    color:form.color,active:form.active,startsAt:form.startsAt||null,endsAt:form.endsAt||null,
    maxUses:form.maxUses?Number(form.maxUses):null,perUserLimit:form.perUserLimit?Number(form.perUserLimit):null,
    perIpLimit:form.perIpLimit?Number(form.perIpLimit):null,perBrowserLimit:form.perBrowserLimit?Number(form.perBrowserLimit):null,
    minimumSpend:form.minimumSpend?Number(form.minimumSpend):null,
   }
   if(mode==="create")await promotionsApi.create(data as Omit<PromotionDTO,"id">)
   else await promotionsApi.update(promo!.id,data)
   toast.success(mode==="create"?"Promotion created.":"Promotion updated.")
   await onSaved()
  }catch(err){
   const message=apiErrorMessage(err)
   setServerError(message)
   if(/code.*(use|belongs|already|valid)/i.test(message))setErrors(prev=>({...prev,code:message}))
  }finally{setBusy(false)}
 }
 const showError=(field:FormKey)=>errors[field]?<p role="alert" className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-300">{errors[field]}</p>:null
 const labelledNumber=(id:string,label:string,field:FormKey,hint:string)=><div className="space-y-1.5">
  <Label htmlFor={id}>{label}</Label>
  <Input id={id} type="number" inputMode="numeric" min={field==="minimumSpend"?0:1} max={field==="minimumSpend"?10000000:1000000} value={form[field] as string} onChange={e=>set(field,e.target.value)} aria-invalid={!!errors[field]} placeholder="Unlimited"/>
  <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>{showError(field)}
 </div>
 return <Dialog open onOpenChange={open=>!open&&!busy&&onClose()}>
  <DialogContent className="flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-h-[90dvh] sm:w-full">
   <DialogHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
    <DialogTitle>{mode==="create"?"Create promotion":"Edit promotion"}</DialogTitle>
    <DialogDescription>Design the offer, control when it runs and decide how many times customers can redeem it.</DialogDescription>
   </DialogHeader>
   <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
    {serverError?<div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">{serverError}</div>:null}
    <div className={cn("space-y-1 rounded-xl p-4",themeBg[form.color])}>
     <p className="text-[10px] font-bold uppercase tracking-widest opacity-90">{form.badge||"Offer preview"}</p>
     <h3 className="text-base font-bold">{form.title||"Your offer headline"}</h3>
     <p className="line-clamp-2 text-xs opacity-90">{form.description||"Customers will see this description."}</p>
     {form.code?<p className="mt-2 text-xs font-bold">USE CODE: {form.code.toUpperCase()}</p>:null}
    </div>
    <section className="space-y-3"><h3 className="text-sm font-bold">Offer details</h3>
     <div className="space-y-1.5"><Label htmlFor="promo-title">Title *</Label><Input id="promo-title" value={form.title} onChange={e=>set("title",e.target.value)} maxLength={160} placeholder="e.g. Flu season savings" aria-invalid={!!errors.title}/>{showError("title")}</div>
     <div className="space-y-1.5"><Label htmlFor="promo-description">Description *</Label><Textarea id="promo-description" rows={2} maxLength={2000} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="What does the customer get, and when?"/>{showError("description")}</div>
     <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="promo-badge">Banner badge</Label><Input id="promo-badge" value={form.badge} onChange={e=>set("badge",e.target.value)} maxLength={24} placeholder="Season offer"/></div>
      <div className="space-y-1.5">
       <Label>Colour theme</Label>
       <div role="group" aria-label="Banner colour theme" className="flex flex-wrap gap-1.5">
        {COLORS.map(color=><button key={color} type="button" aria-label={color+" theme"} title={color} aria-pressed={form.color===color} onClick={()=>set("color",color)}
         className={cn("grid h-9 w-9 place-items-center rounded-full border-2 transition-transform",form.color===color?"border-foreground scale-105":"border-transparent")}>
         <span className={cn("h-6 w-6 rounded-full",themeDot[color])}/></button>)}
       </div>
      </div>
     </div>
    </section>
    <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-bold">Checkout discount</h3>
     <p className="text-xs text-muted-foreground">Leave code empty for an informational banner. Codes only apply to orders after customers enter or open the checkout link.</p>
     <div className="flex items-end gap-2">
      <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="promo-code">Promotion code</Label>
       <Input id="promo-code" value={form.code} onChange={e=>set("code",e.target.value.toUpperCase().replace(/\s/g,""))} aria-invalid={!!errors.code} className="font-mono uppercase" placeholder="e.g. FLU15"/>
      </div>
      <Button type="button" variant="outline" className="shrink-0 gap-1.5" onClick={generate}><WandSparkles className="h-4 w-4"/> Generate</Button>
     </div>{showError("code")}
     <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="promo-discount">Discount %</Label>
       <Input id="promo-discount" type="number" inputMode="numeric" min={1} max={90} value={form.discountPct} onChange={e=>set("discountPct",e.target.value)} placeholder="15" aria-invalid={!!errors.discountPct}/>{showError("discountPct")}
      </div>
      {labelledNumber("promo-minimum","Minimum order (KSh)","minimumSpend","Optional minimum order subtotal.")}
     </div>
    </section>
    <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-bold">Availability</h3>
     <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5"><Label htmlFor="promo-start">Start date (optional)</Label><Input id="promo-start" type="date" value={form.startsAt} onChange={e=>set("startsAt",e.target.value)}/></div>
      <div className="space-y-1.5"><Label htmlFor="promo-end">End date (optional)</Label><Input id="promo-end" type="date" value={form.endsAt} onChange={e=>set("endsAt",e.target.value)} aria-invalid={!!errors.endsAt}/>{showError("endsAt")}</div>
     </div>
     <p className="text-xs text-muted-foreground">Dates use Nairobi time (EAT). The promotion stays valid through the selected end date.</p>
    </section>
    <section className="space-y-3 border-t pt-4">
     <button className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold" type="button" aria-expanded={showLimits} onClick={()=>setShowLimits(v=>!v)}>
      <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4"/> Redemption limits</span>
      <ChevronDown className={cn("h-4 w-4 transition-transform",showLimits&&"rotate-180")}/>
     </button>
     {showLimits?<div className="grid gap-3 sm:grid-cols-2">
      {labelledNumber("promo-max-uses","Total redemptions","maxUses","Across every customer; blank means unlimited.")}
      {labelledNumber("promo-user-limit","Per account","perUserLimit","Default 2. Requires customers to sign in.")}
      {labelledNumber("promo-browser-limit","Per browser","perBrowserLimit","Default 2. Cookie-based, can be reset by the user.")}
      {labelledNumber("promo-ip-limit","Per network/IP","perIpLimit","Optional; shared Wi-Fi users count toward the same cap.")}
     </div>:<p className="text-xs text-muted-foreground">Per-account and per-browser limits default to two uses for new codes. Expand to change or disable limits.</p>}
    </section>
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/25 p-3">
     <div><Label htmlFor="promo-active">Enable promotion</Label><p className="mt-1 text-xs text-muted-foreground">Scheduling still determines when it becomes visible.</p></div>
     <Switch id="promo-active" checked={form.active} onCheckedChange={v=>set("active",v)}/>
    </div>
   </div>
   <DialogFooter className="shrink-0 border-t bg-background p-3 sm:p-4">
    <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
    <Button disabled={busy} onClick={()=>void save()}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Check className="mr-2 h-4 w-4"/>}{mode==="create"?"Create promotion":"Save changes"}</Button>
   </DialogFooter>
  </DialogContent>
 </Dialog>
}
