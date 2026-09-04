"use client"

// Settings (ADMIN only) — pharmacy profile form (powers the storefront header/footer),
// delivery settings (flat vs zone fees, free-over threshold, night delivery, zone
// editor) and a demo-credentials reference card.

import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { SectionHeader } from "@/components/shared/empty-state"
import { UseCurrentLocationButton } from "@/components/shared/use-current-location-button"
import { settingsApi } from "@/lib/api-client"
import type { DeliverySettings, PharmacySettings } from "@/lib/types"
import { toast } from "sonner"
import { apiErrorMessage, SectionError, type SectionProps } from "../admin-shared"
import { Save, Loader2, Info, Building2, Truck, MoonStar, KeyRound, Trash2, Plus, Bell, Mail, Send, CheckCircle2, MapPinned, Search } from "lucide-react"

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@spherepharmacy.co.ke", password: "admin123" },
  { role: "Pharmacist", email: "pharmacist@spherepharmacy.co.ke", password: "pharm123" },
  { role: "Pharmacy staff", email: "staff@spherepharmacy.co.ke", password: "staff123" },
  { role: "Rider", email: "rider@spherepharmacy.co.ke", password: "rider123" },
  { role: "Customer (demo)", email: "customer@spherepharmacy.co.ke", password: "customer123" },
]

export function SettingsSection({ refreshKey, onRefresh }: SectionProps) {
  const [pharmacy, setPharmacy] = useState<PharmacySettings | null>(null)
  const [delivery, setDelivery] = useState<DeliverySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingPharmacy, setSavingPharmacy] = useState(false)
  const [savingDelivery, setSavingDelivery] = useState(false)
  const [testingPush, setTestingPush] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [locationResults, setLocationResults] = useState<{displayName:string;latitude:number;longitude:number}[]>([])
  const [searchingLocation, setSearchingLocation] = useState(false)

  async function searchLocation() {
    if (locationSearch.trim().length < 2) return
    setSearchingLocation(true)
    try {
      const response = await fetch("/api/location/search?q=" + encodeURIComponent(locationSearch.trim()))
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Location search failed.")
      setLocationResults(data.results || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not search for that place.")
    } finally {
      setSearchingLocation(false)
    }
  }

  function setPharmacyDeliveryLocation(location:{displayName:string;latitude:number;longitude:number}) {
    setDelivery((current) => current ? ({
      ...current,
      pharmacyLocation: { latitude: location.latitude, longitude: location.longitude, label: location.displayName },
    }) : current)
    setLocationResults([])
    toast.success("Delivery origin updated. Save delivery settings to publish it.")
  }

  async function testNotification(type: "PUSH" | "EMAIL") {
    if (type === "PUSH") setTestingPush(true)
    else setTestingEmail(true)
    try {
      const res = await fetch("/api/notifications/dispatch-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(data.message || `Test ${type.toLowerCase()} delivered successfully.`)
      } else {
        toast.error(data.message || data.error || "The notification provider rejected the test.")
      }
    } catch {
      toast.error("Failed to connect to notification service.")
    } finally {
      if (type === "PUSH") setTestingPush(false)
      else setTestingEmail(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const settings = await settingsApi.get()
      setPharmacy(settings.pharmacy)
      setDelivery(settings.delivery)
    } catch (err) {
      setError(apiErrorMessage(err))
      setPharmacy(null)
      setDelivery(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  async function savePharmacy() {
    if (!pharmacy) return
    setSavingPharmacy(true)
    try {
      await settingsApi.update({ pharmacy })
      toast.success("Pharmacy profile saved — storefront header and footer update immediately.")
      onRefresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSavingPharmacy(false)
    }
  }

  async function saveDelivery() {
    if (!delivery) return
    setSavingDelivery(true)
    try {
      await settingsApi.update({ delivery })
      toast.success("Delivery settings saved — checkout fees update immediately.")
      onRefresh()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setSavingDelivery(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    )
  }

  if (error || !pharmacy || !delivery) {
    return <SectionError message={error ?? "Settings unavailable."} onRetry={() => void load()} />
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Settings"
        subtitle="These settings power the storefront — contact details, opening hours and delivery fees."
      />

      <p className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Changes go live on the storefront immediately after saving — hours, phone, WhatsApp and checkout delivery fees
        all read from here.
      </p>

      {/* pharmacy profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden /> Pharmacy profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Pharmacy name</Label>
              <Input id="s-name" value={pharmacy.name} onChange={(e) => setPharmacy((p) => (p ? { ...p, name: e.target.value } : p))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-tagline">Tagline</Label>
              <Input id="s-tagline" value={pharmacy.tagline} onChange={(e) => setPharmacy((p) => (p ? { ...p, tagline: e.target.value } : p))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone</Label>
              <Input id="s-phone" value={pharmacy.phone} onChange={(e) => setPharmacy((p) => (p ? { ...p, phone: e.target.value } : p))} placeholder="+254…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-wa">WhatsApp number</Label>
              <Input id="s-wa" value={pharmacy.whatsapp} onChange={(e) => setPharmacy((p) => (p ? { ...p, whatsapp: e.target.value } : p))} placeholder="2547…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-email">Email</Label>
              <Input id="s-email" type="email" value={pharmacy.email} onChange={(e) => setPharmacy((p) => (p ? { ...p, email: e.target.value } : p))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-hours">Opening hours label</Label>
              <Input id="s-hours" value={pharmacy.hoursLabel} onChange={(e) => setPharmacy((p) => (p ? { ...p, hoursLabel: e.target.value } : p))} placeholder="Open daily · 8:00 AM – 10:30 PM" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-address">Address</Label>
              <Textarea id="s-address" value={pharmacy.address} onChange={(e) => setPharmacy((p) => (p ? { ...p, address: e.target.value } : p))} rows={2} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="s-maps">Google Maps URL</Label>
              <Input id="s-maps" value={pharmacy.mapsUrl} onChange={(e) => setPharmacy((p) => (p ? { ...p, mapsUrl: e.target.value } : p))} placeholder="https://www.google.com/maps/…" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => void savePharmacy()} disabled={savingPharmacy}>
              {savingPharmacy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
              Save pharmacy profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* delivery settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4 text-muted-foreground" aria-hidden /> Delivery settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2.5">
            <Label>Fee mode</Label>
            <RadioGroup
              value={delivery.mode}
              onValueChange={(v) => setDelivery((d) => (d ? { ...d, mode: v as "flat" | "zone" } : d))}
              className="grid gap-2.5 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="flat" className="mt-0.5" aria-label="Flat fee delivery" />
                <span>
                  <span className="block text-sm font-medium">Flat fee</span>
                  <span className="block text-xs text-muted-foreground">One fee for all areas (plus night surcharge if enabled).</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5">
                <RadioGroupItem value="zone" className="mt-0.5" aria-label="Zone-based delivery fees" />
                <span>
                  <span className="block text-sm font-medium">Zone-based</span>
                  <span className="block text-xs text-muted-foreground">Different fee per area (Roysambu, Kasarani, CBD…).</span>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-flat">Flat fee (KSh)</Label>
              <Input
                id="d-flat"
                type="number"
                min={0}
                value={delivery.flatFee}
                onChange={(e) => setDelivery((d) => (d ? { ...d, flatFee: Number(e.target.value) || 0 } : d))}
                disabled={delivery.mode !== "flat"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-free">Free delivery over (KSh)</Label>
              <Input
                id="d-free"
                type="number"
                min={0}
                value={delivery.freeOver ?? ""}
                onChange={(e) => setDelivery((d) => (d ? { ...d, freeOver: e.target.value ? Number(e.target.value) : null } : d))}
                placeholder="e.g. 3000 (blank = never free)"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-start gap-2.5">
              <MoonStar className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <Label htmlFor="d-night" className="text-sm">Night delivery (+KSh 100)</Label>
                <p className="text-xs text-muted-foreground">Allow orders delivered 8:30 PM – midnight with a surcharge.</p>
              </div>
            </div>
            <Switch
              id="d-night"
              checked={delivery.nightDelivery}
              onCheckedChange={(v) => setDelivery((d) => (d ? { ...d, nightDelivery: v } : d))}
            />
          </div>

          {/* delivery origin and distance pricing */}
          <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Delivery origin & pricing method</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pin the pharmacy once. Distance pricing can then calculate delivery automatically from the customer's location.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <UseCurrentLocationButton
                onResolved={(location) => {
                  setDelivery((current) =>
                    current
                      ? {
                          ...current,
                          pharmacyLocation: {
                            latitude: location.latitude,
                            longitude: location.longitude,
                            label: location.displayName,
                          },
                        }
                      : current
                  )
                }}
              />
              {delivery.pharmacyLocation?.latitude != null && delivery.pharmacyLocation?.longitude != null ? (
                <div className="flex items-center rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Pinned:</span>
                  <span className="ml-1.5 max-w-[420px] truncate">{delivery.pharmacyLocation.label}</span>
                </div>
              ) : null}
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                placeholder="Search the pharmacy location, e.g. Sphere Pharmacy Lumumba Drive"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void searchLocation()
                }}
              />
              <Button type="button" variant="outline" onClick={() => void searchLocation()} disabled={searchingLocation}>
                {searchingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search place
              </Button>
            </div>

            {locationResults.length > 0 ? (
              <div className="space-y-2">
                {locationResults.map((result) => (
                  <button
                    key={result.displayName + result.latitude}
                    type="button"
                    onClick={() => {
                      setDelivery((current) =>
                        current
                          ? {
                              ...current,
                              pharmacyLocation: {
                                latitude: result.latitude,
                                longitude: result.longitude,
                                label: result.displayName,
                              },
                            }
                          : current
                      )
                      setLocationResults([])
                    }}
                    className="w-full rounded-xl border bg-background p-3 text-left hover:bg-accent"
                  >
                    <span className="block text-sm font-medium">{result.displayName}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <RadioGroup
              value={delivery.pricingMode ?? "zone"}
              onValueChange={(value) =>
                setDelivery((current) =>
                  current ? { ...current, pricingMode: value as "zone" | "distance" } : current
                )
              }
              className="grid gap-2 sm:grid-cols-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3">
                <RadioGroupItem value="zone" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Named delivery zones</span>
                  <span className="block text-xs text-muted-foreground">Use the existing area-based fees.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background p-3">
                <RadioGroupItem value="distance" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Distance-based pricing</span>
                  <span className="block text-xs text-muted-foreground">Calculate from the pharmacy automatically.</span>
                </span>
              </label>
            </RadioGroup>

            {(delivery.pricingMode ?? "zone") === "distance" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Distance price bands</Label>
                    <p className="text-xs text-muted-foreground">Example: 0–2 km, 2–5 km, 5–10 km.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDelivery((current) => {
                        if (!current) return current
                        const bands = current.distanceBands ?? []
                        const minKm = bands[bands.length - 1]?.maxKm ?? 0
                        return {
                          ...current,
                          distanceBands: [
                            ...bands,
                            { id: "band-" + Date.now(), minKm, maxKm: null, fee: 200, label: "New band" },
                          ],
                        }
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" /> Add band
                  </Button>
                </div>

                {(delivery.distanceBands ?? []).map((band, index) => (
                  <div key={band.id} className="grid gap-2 sm:grid-cols-[1.2fr_100px_100px_120px_44px]">
                    <Input
                      value={band.label}
                      onChange={(e) =>
                        setDelivery((current) =>
                          current
                            ? {
                                ...current,
                                distanceBands: (current.distanceBands ?? []).map((item, i) =>
                                  i === index ? { ...item, label: e.target.value } : item
                                ),
                              }
                            : current
                        )
                      }
                      placeholder="Up to 2 km"
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={band.minKm}
                      onChange={(e) =>
                        setDelivery((current) =>
                          current
                            ? {
                                ...current,
                                distanceBands: (current.distanceBands ?? []).map((item, i) =>
                                  i === index ? { ...item, minKm: Number(e.target.value) || 0 } : item
                                ),
                              }
                            : current
                        )
                      }
                      aria-label={band.label + " minimum kilometres"}
                    />
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={band.maxKm ?? ""}
                      onChange={(e) =>
                        setDelivery((current) =>
                          current
                            ? {
                                ...current,
                                distanceBands: (current.distanceBands ?? []).map((item, i) =>
                                  i === index
                                    ? { ...item, maxKm: e.target.value ? Number(e.target.value) : null }
                                    : item
                                ),
                              }
                            : current
                        )
                      }
                      placeholder="∞"
                      aria-label={band.label + " maximum kilometres"}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={band.fee}
                      onChange={(e) =>
                        setDelivery((current) =>
                          current
                            ? {
                                ...current,
                                distanceBands: (current.distanceBands ?? []).map((item, i) =>
                                  i === index ? { ...item, fee: Math.max(0, Number(e.target.value) || 0) } : item
                                ),
                              }
                            : current
                        )
                      }
                      aria-label={band.label + " delivery fee in Kenyan shillings"}
                      placeholder="KSh"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() =>
                        setDelivery((current) =>
                          current
                            ? { ...current, distanceBands: (current.distanceBands ?? []).filter((_, i) => i !== index) }
                            : current
                        )
                      }
                      aria-label={"Remove " + band.label}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {(delivery.distanceBands ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    Add at least one distance band before enabling distance pricing.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* zones editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Delivery zones</Label>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={delivery.mode !== "zone"}
                onClick={() => setDelivery((d) => (d ? { ...d, zones: [...d.zones, { name: "", fee: 200 }] } : d))}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add zone
              </Button>
            </div>
            <div className={delivery.mode !== "zone" ? "pointer-events-none opacity-60" : ""}>
              <div className="space-y-2">
                {delivery.zones.map((zone, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_120px_44px]">
                    <Input
                      value={zone.name}
                      onChange={(e) =>
                        setDelivery((d) => (d ? { ...d, zones: d.zones.map((z, j) => (j === i ? { ...z, name: e.target.value } : z)) } : d))
                      }
                      placeholder={`Zone ${i + 1} name`}
                      aria-label={`Zone ${i + 1} name`}
                    />
                    <Input
                      type="number"
                      min={0}
                      value={zone.fee}
                      onChange={(e) =>
                        setDelivery((d) => (d ? { ...d, zones: d.zones.map((z, j) => (j === i ? { ...z, fee: Number(e.target.value) || 0 } : z)) } : d))
                      }
                      aria-label={`Zone ${i + 1} fee in Kenyan shillings`}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-muted-foreground hover:text-rose-600"
                      onClick={() => setDelivery((d) => (d ? { ...d, zones: d.zones.filter((_, j) => j !== i) } : d))}
                      aria-label={`Remove zone ${zone.name || i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {delivery.zones.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    No zones yet — add areas like Roysambu, Kasarani and Nairobi CBD.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void saveDelivery()} disabled={savingDelivery}>
              {savingDelivery ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Save className="mr-2 h-4 w-4" aria-hidden />}
              Save delivery settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* notifications & messaging integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4 text-primary" aria-hidden /> Push Notifications & Email Integrations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Multi-channel notifications keep customers informed of order progress and instantly alert pharmacy staff of new orders, prescription uploads, and low-stock events.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Firebase Cloud Messaging panel */}
            <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <Bell className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold">Firebase Cloud Messaging</h4>
                  <p className="text-xs text-muted-foreground">Web Push & Mobile Push Notifications</p>
                </div>
              </div>

              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Customer order & delivery alerts</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Pharmacist prescription review alerts</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Rider dispatch drop-off assignments</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => void testNotification("PUSH")}
                disabled={testingPush}
              >
                {testingPush ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Test Push Notification
              </Button>
            </div>

            {/* Resend Email panel */}
            <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                  <Mail className="h-4 w-4" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold">Resend Email Integration</h4>
                  <p className="text-xs text-muted-foreground">Transactional HTML Email Receipts & Alerts</p>
                </div>
              </div>

              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Full itemized order confirmation receipts</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Payment confirmations & Sphere Points balance</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Staff alerts for new orders & low stock</span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-xs"
                onClick={() => void testNotification("EMAIL")}
                disabled={testingEmail}
              >
                {testingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Test Resend Email Dispatch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* demo credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden /> Demo data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <Info className="h-4 w-4" />
            <AlertTitle>Demo credentials — never use in production</AlertTitle>
            <AlertDescription className="text-amber-800 dark:text-amber-300">
              These accounts exist only in the sandbox database for testing each role. Replace them before go-live.
            </AlertDescription>
          </Alert>
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y text-sm">
              {DEMO_ACCOUNTS.map((acct) => (
                <li key={acct.email} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                  <span className="w-32 shrink-0 text-xs font-semibold text-muted-foreground">{acct.role}</span>
                  <span className="font-mono text-xs">{acct.email}</span>
                  <Separator className="hidden h-4 w-px sm:block" orientation="vertical" />
                  <span className="ml-auto font-mono text-xs text-muted-foreground">{acct.password}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">
            Staff sign in via the staff sign-in tab on the auth screen; customers can also use phone-OTP demo codes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
