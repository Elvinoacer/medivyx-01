"use client"

import { useRef, useState } from "react"
import type { FormEvent } from "react"
import { CheckCircle2, Loader2, Pill } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { medicineRequestsApi } from "@/lib/api-client"
import { medicineRequestSchema, MEDICINE_PHOTO_MAX_BYTES, MEDICINE_PHOTO_TYPES } from "@/lib/medicine-requests"
import { useAuthStore } from "@/store/use-auth-store"

export function MedicineRequest({ search }: { search: string }) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Can’t find your medicine?</p>
          <p className="mt-1 text-xs text-muted-foreground">Tell us what you need and leave your number. A photo is optional.</p>
        </div>
        <Button variant="outline" className="shrink-0 gap-2" onClick={() => { setFormKey((value) => value + 1); setOpen(true) }}>
          <Pill className="h-4 w-4" aria-hidden /> Request medicine
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request a medicine</DialogTitle>
            <DialogDescription>Leave the medicine name and your phone number. Our team will contact you about availability.</DialogDescription>
          </DialogHeader>
          <MedicineRequestForm key={formKey} initialName={search} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

function MedicineRequestForm({ initialName, onClose }: { initialName: string; onClose: () => void }) {
  const phone = useAuthStore((state) => state.session?.user?.phone)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    const form = new FormData(event.currentTarget)
    const details = { medicineName: String(form.get("medicineName") || ""), phone: String(form.get("phone") || "") }
    const validation = medicineRequestSchema.safeParse(details)
    if (!validation.success) { setError(validation.error.issues[0].message); return }
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      let attachment: { name: string; type: typeof MEDICINE_PHOTO_TYPES[number]; data: string } | undefined
      if (photo) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(",")[1])
          reader.onerror = () => reject(new Error("Could not read the photo. Please choose it again."))
          reader.readAsDataURL(photo)
        })
        attachment = { name: photo.name, type: photo.type as typeof MEDICINE_PHOTO_TYPES[number], data }
      }
      await medicineRequestsApi.create({ ...details, photo: attachment })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your request. Please try again.")
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (submitted) return (
    <div className="space-y-4 py-3 text-center" role="status">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" aria-hidden />
      <p className="font-semibold">Your request has been received</p>
      <p className="text-sm text-muted-foreground">Our team will contact you on the number you provided. Availability will be confirmed when we follow up.</p>
      <Button className="w-full" onClick={onClose}>Done</Button>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="medicine-request-name">Medicine name</Label>
          <Input id="medicine-request-name" name="medicineName" defaultValue={initialName.slice(0, 200)} required minLength={2} maxLength={200} placeholder="Medicine name, strength or brand" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="medicine-request-phone">Phone number</Label>
          <Input id="medicine-request-phone" name="phone" type="tel" autoComplete="tel" defaultValue={phone || ""} required maxLength={30} placeholder="0712 345 678" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="medicine-request-photo">Medicine photo <span className="text-muted-foreground">(optional)</span></Label>
          <Input ref={fileRef} id="medicine-request-photo" type="file" accept={MEDICINE_PHOTO_TYPES.join(",")} aria-describedby="medicine-photo-help" onChange={(event) => {
            const file = event.target.files?.[0] || null
            if (file && (!MEDICINE_PHOTO_TYPES.some((type) => type === file.type) || file.size > MEDICINE_PHOTO_MAX_BYTES || file.size === 0 || file.name.length > 120)) {
              setError("Choose a JPG, PNG or WebP photo up to 3MB with a filename under 120 characters.")
              event.target.value = ""
              setPhoto(null)
              return
            }
            setError(null)
            setPhoto(file)
          }} />
          <p id="medicine-photo-help" className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 3MB. Only our pharmacy team can view it.</p>
          {photo ? <Button type="button" variant="ghost" size="sm" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = "" }}>Remove photo</Button> : null}
        </div>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">We’ll use your number to follow up on this request. No account needed.</p>
      <Button type="submit" className="w-full gap-2" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {busy ? "Sending request…" : "Send request"}
      </Button>
    </form>
  )
}
