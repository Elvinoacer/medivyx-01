"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Switch } from "@/components/ui/switch"
import { Toaster } from "@/components/ui/sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { useAppStore } from "@/store/use-app-store"
import { useCartStore } from "@/store/use-cart-store"
import { useAuthStore } from "@/store/use-auth-store"
import {
  ordersApi, paymentsApi, prescriptionsApi, settingsApi, addressesApi, promotionsApi, storageApi,
  type CreateOrderPayload,
} from "@/lib/api-client"
import type { AddressDTO, DeliverySettings, OrderDTO } from "@/lib/types"
import { DELIVERY_DEFAULTS, LOYALTY, PHARMACY, maxRedeemablePoints, pointsForAmount, waLink } from "@/lib/constants"
import { formatKES } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { UseCurrentLocationButton } from "@/components/shared/use-current-location-button"
import {
  MapPin, Truck, Store, ClipboardList, CreditCard, CheckCircle2, ChevronLeft, Loader2,
  FileWarning, Upload, FileText, X, Copy, Check, ShieldCheck, Banknote, Phone, User,
  Package, Lock, MessageCircle, TriangleAlert, Hourglass, Ticket, Sparkles,
} from "lucide-react"

// ---------- local types ----------

type PayMethod = "MPESA" | "CARD" | "CASH" | "LATER"
type PaymentPhase = "select" | "awaiting_pin" | "failed"
type Step = 1 | 2 | 3 | 4

interface StagedRx {
  key: string
  fileName: string
  fileType: string
  dataUrl: string
  base64: string
  notes: string
}

interface UploadedRx {
  id: string
  fileName: string
  notes: string
}

interface CardForm {
  number: string
  name: string
  expiry: string
  cvv: string
}

const STEPS: { id: Step; label: string; hint: string; icon: typeof MapPin }[] = [
  { id: 1, label: "Fulfillment", hint: "Pickup or delivery", icon: MapPin },
  { id: 2, label: "Details", hint: "Contact & address", icon: ClipboardList },
  { id: 3, label: "Payment", hint: "M-Pesa, card, cash", icon: CreditCard },
  { id: 4, label: "Confirm", hint: "All done", icon: CheckCircle2 },
]

const MAX_RX_FILE_BYTES = 10 * 1024 * 1024
const RX_FILE_TYPES = /^image\/(png|jpe?g|webp|gif|heic|heif)$|^application\/pdf$/

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`
  if (/^254[17]\d{8}$/.test(digits)) return digits
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`
  return null
}

function validateCard(c: CardForm): string | null {
  const digits = c.number.replace(/[\s-]/g, "")
  if (!/^\d{15,19}$/.test(digits)) return "Enter a valid 16-digit card number."
  if (!c.name.trim()) return "Enter the name printed on the card."
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(c.expiry.trim())
  if (!m) return "Expiry must be in MM/YY format."
  const mm = Number(m[1])
  const yy = 2000 + Number(m[2])
  if (mm < 1 || mm > 12) return "Expiry month must be between 01 and 12."
  const endOfMonth = new Date(yy, mm, 0, 23, 59, 59)
  if (endOfMonth.getTime() < Date.now()) return "This card has expired."
  if (!/^\d{3,4}$/.test(c.cvv)) return "CVV must be 3 or 4 digits."
  return null
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

// ============================== VIEW ==============================

export function CheckoutView() {
  const navigate = useAppStore((s) => s.navigate)
  const openAuth = useAppStore((s) => s.openAuth)
  const lines = useCartStore((s) => s.lines)
  const clearCart = useCartStore((s) => s.clear)
  const session = useAuthStore((s) => s.session)
  const refreshSession = useAuthStore((s) => s.refresh)
  const user = session?.user ?? null

  // ---------- step / fulfillment ----------
  const [step, setStep] = useState<Step>(1)
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP")
  const [zone, setZone] = useState<string>("")
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)

  // ---------- delivery settings ----------
  const [settings, setSettings] = useState<DeliverySettings | null>(null)
  useEffect(() => {
    let cancelled = false
    settingsApi
      .get()
      .then((s) => {
        if (!cancelled) setSettings(s.delivery)
      })
      .catch(() => {
        if (!cancelled) setSettings(DELIVERY_DEFAULTS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const zones = (settings?.zones ?? DELIVERY_DEFAULTS.zones).map((z) => ({ name: z.name.trim(), fee: z.fee }))
  const freeOver = settings?.freeOver ?? DELIVERY_DEFAULTS.freeOver
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0)

  // ---------- delivery fee ----------
  const [feeInfo, setFeeInfo] = useState<{ fee: number; freeOver: number | null; mode: string } | null>(null)
  useEffect(() => {
    if (fulfillment !== "DELIVERY" || !zone) {
      setFeeInfo(null)
      return
    }
    let cancelled = false
    setFeeInfo(null)
    settingsApi
      .deliveryFee(zone, subtotal, deliveryCoordinates?.latitude, deliveryCoordinates?.longitude)
      .then((f) => {
        if (!cancelled) setFeeInfo(f)
      })
      .catch(() => {
        if (!cancelled) setFeeInfo(null)
      })
    return () => {
      cancelled = true
    }
  }, [fulfillment, zone, subtotal, deliveryCoordinates?.latitude, deliveryCoordinates?.longitude])

  const rxCount = lines.filter((l) => l.requiresPrescription).length
  const hasRx = rxCount > 0
  const fallbackFee = zone ? (zones.find((z) => z.name.toLowerCase() === zone.toLowerCase())?.fee ?? DELIVERY_DEFAULTS.flatFee) : null
  const freeEligible = freeOver != null && subtotal >= freeOver
  const deliveryFee: number | null =
    fulfillment === "PICKUP" ? 0 : !zone ? null : freeEligible ? 0 : (feeInfo?.fee ?? fallbackFee ?? 0)

  // ---------- promo code ----------
  const [promoInput, setPromoInput] = useState("")
  const [promo, setPromo] = useState<{ code: string; discountPct: number; discountAmount: number } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoBusy, setPromoBusy] = useState(false)

  // ---------- Sphere Points redemption state ----------
  const [redeemPoints, setRedeemPoints] = useState(false)

  const discountAmount = promo?.discountAmount ?? 0

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase()
    if (!code) {
      setPromoError("Enter a promo code.")
      return
    }
    setPromoBusy(true)
    setPromoError(null)
    try {
      const res = await promotionsApi.validate(code, subtotal)
      setPromo({ code: res.promotion.code ?? code, discountPct: res.promotion.discountPct ?? 0, discountAmount: res.discountAmount })
      toast.success(`Code ${res.promotion.code} applied — ${res.promotion.discountPct}% off your subtotal!`)
    } catch (err) {
      setPromo(null)
      setPromoError(err instanceof Error ? err.message : "That code isn't valid.")
    } finally {
      setPromoBusy(false)
    }
  }

  function removePromo() {
    setPromo(null)
    setPromoInput("")
    setPromoError(null)
  }

  // ---------- guest details ----------
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState(user?.phone ?? "")
  const [guestEmail, setGuestEmail] = useState("")

  // ---------- addresses (logged in) ----------
  const [addresses, setAddresses] = useState<AddressDTO[] | null>(null)
  const [addressMode, setAddressMode] = useState<"saved" | "new">("saved")
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressText, setAddressText] = useState("")
  useEffect(() => {
    if (!user) {
      setAddresses(null)
      return
    }
    let cancelled = false
    addressesApi
      .list()
      .then((a) => {
        if (cancelled) return
        setAddresses(a)
        const preferred = a.find((x) => x.isDefault) ?? a[0]
        if (preferred) {
          setSelectedAddressId(preferred.id)
          const match = zones.find(
            (z) => z.name.toLowerCase() === (preferred.area ?? "").trim().toLowerCase()
          )
          if (match) setZone(match.name)
          if (preferred.latitude != null && preferred.longitude != null) setDeliveryCoordinates({ latitude: preferred.latitude, longitude: preferred.longitude })
        } else {
          setAddressMode("new")
        }
      })
      .catch(() => {
        if (!cancelled) setAddresses([])
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  function selectSavedAddress(a: AddressDTO) {
    setSelectedAddressId(a.id)
    const match = zones.find((z) => z.name.toLowerCase() === (a.area ?? "").trim().toLowerCase())
    if (match) setZone(match.name)
    if (a.latitude != null && a.longitude != null) setDeliveryCoordinates({ latitude: a.latitude, longitude: a.longitude })
  }

  const selectedAddress = addresses?.find((a) => a.id === selectedAddressId) ?? null

  // if a saved address is selected but the zone hasn't been picked yet (settings loaded late), sync it
  useEffect(() => {
    if (addressMode !== "saved" || !selectedAddress || zone) return
    const match = zones.find((z) => z.name.toLowerCase() === (selectedAddress.area ?? "").trim().toLowerCase())
    if (match) setZone(match.name)
  }, [addressMode, selectedAddress?.id, selectedAddress?.area, zone, zones.length])

  // ---------- notes ----------
  const [orderNotes, setOrderNotes] = useState("")
  const [deliveryNotes, setDeliveryNotes] = useState("")

  // ---------- prescriptions ----------
  const [staged, setStaged] = useState<StagedRx[]>([])
  const [uploaded, setUploaded] = useState<UploadedRx[]>([])
  const [uploading, setUploading] = useState(false)
  const [rxError, setRxError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    for (const f of files) {
      if (!RX_FILE_TYPES.test(f.type)) {
        toast.error(`${f.name}: only photos (JPG/PNG/WebP) or PDF files are accepted.`)
        continue
      }
      if (f.size > MAX_RX_FILE_BYTES) {
        toast.error(`${f.name} is larger than the 10MB limit.`)
        continue
      }
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : ""
        setStaged((prev) => [
          ...prev,
          {
            key: `${f.name}-${Date.now()}-${prev.length}`,
            fileName: f.name,
            fileType: f.type,
            dataUrl,
            base64: dataUrl.split(",")[1] ?? "",
            notes: "",
          },
        ])
      }
      reader.onerror = () => toast.error(`Couldn't read ${f.name}.`)
      reader.readAsDataURL(f)
    }
  }

  async function uploadStaged() {
    if (staged.length === 0) return
    setUploading(true)
    setRxError(null)
    try {
      const results: UploadedRx[] = []
      for (const s of staged) {
        let fileUrl: string | undefined
        let storageKey: string | undefined
        let fileData: string | undefined = s.base64

        try {
          const r2Res = await storageApi.uploadBase64({
            fileData: s.base64,
            fileName: s.fileName,
            fileType: s.fileType,
            folder: "prescriptions",
          })
          fileUrl = r2Res.url
          storageKey = r2Res.key
          fileData = undefined
        } catch (uploadErr) {
          console.warn("[R2 direct upload fallback in checkout]:", uploadErr)
        }

        const rx = await prescriptionsApi.upload({
          fileName: s.fileName,
          fileType: s.fileType,
          fileData,
          fileUrl,
          storageKey,
          notes: s.notes.trim() || undefined,
        })
        results.push({ id: rx.id, fileName: s.fileName, notes: s.notes })
      }
      setUploaded((prev) => [...prev, ...results])
      setStaged([])
      toast.success(
        results.length > 1
          ? `${results.length} prescriptions uploaded — pending pharmacist review`
          : "Prescription uploaded — pending pharmacist review"
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again."
      setRxError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }

  // ---------- payment ----------
  const [method, setMethod] = useState<PayMethod>("MPESA")
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone ?? "")
  const [card, setCard] = useState<CardForm>({ number: "", name: "", expiry: "", cvv: "" })
  const [placing, setPlacing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>("select")
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [placedOrder, setPlacedOrder] = useState<OrderDTO | null>(null)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  const celebrateRef = useRef(false)
  useEffect(() => {
    if (step === 4 && placedOrder && !celebrateRef.current) {
      celebrateRef.current = true
      clearCart()
    }
  }, [step, placedOrder, clearCart])

  // ---------- derived: totals + Sphere Points quote ----------
  const loyaltyBalance = user?.loyaltyPoints ?? 0
  const postPromoSubtotal = Math.max(0, subtotal - discountAmount)
  // Server quote rule: min(balance, 25% cap), zero below the 100-pt minimum — mirror it
  const redeemQuote = maxRedeemablePoints(postPromoSubtotal, loyaltyBalance)
  const redeemValue = redeemQuote * LOYALTY.pointValue
  const pointsEligible = user != null && loyaltyBalance >= LOYALTY.minRedeem && redeemQuote >= LOYALTY.minRedeem
  const total = Math.max(
    0,
    subtotal - discountAmount + (deliveryFee ?? 0) - (redeemPoints && pointsEligible ? redeemValue : 0)
  )
  /** What the customer will actually be charged (server-computed once the order exists). */
  const payableTotal = placedOrder ? placedOrder.total : total
  /** Points the server will award on payment (net of any redemption, floored). */
  const pointsForEarnEstimate = placedOrder
    ? pointsForAmount(Math.max(0, placedOrder.total - placedOrder.pointsRedeemed * LOYALTY.pointValue))
    : 0

  // ---------- guards ----------
  if (lines.length === 0 && !placedOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Toaster position="bottom-left" richColors closeButton />
        <EmptyState
          icon={Package}
          title="Nothing to check out"
          description="Your cart is empty — add a few items first, then come back to checkout."
          action={{ label: "Back to cart", onClick: () => navigate("cart") }}
        />
      </div>
    )
  }

  // ---------- helpers ----------

  function goTo(n: Step) {
    if (placedOrder) return
    if (n < step) {
      setStep(n)
      setInlineError(null)
    }
  }

  function buildPayload(paymentMethod: PayMethod, addressId?: string): CreateOrderPayload {
    return {
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
      fulfillment,
      reservation: paymentMethod === "LATER",
      paymentMethod,
      ...(user
        ? {}
        : { customer: { name: guestName.trim(), phone: normalizePhone(guestPhone) ?? guestPhone.trim() } }),
      ...(fulfillment === "DELIVERY"
        ? {
            deliveryArea: zone,
            ...(addressId
              ? { addressId }
              : { deliveryAddress: addressText.trim() }),
            ...(deliveryNotes.trim() ? { deliveryNotes: deliveryNotes.trim() } : {}),
          }
        : {}),
      ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
      ...(uploaded.length > 0 ? { prescriptionIds: uploaded.map((u) => u.id) } : {}),
      ...(promo ? { promotionCode: promo.code } : {}),
      ...(redeemPoints && pointsEligible ? { redeemPoints: true } : {}),
      ...(deliveryCoordinates ? { deliveryLatitude: deliveryCoordinates.latitude, deliveryLongitude: deliveryCoordinates.longitude } : {}),
    }
  }

  async function placeOrder(paymentMethod: PayMethod): Promise<OrderDTO | null> {
    setPlacing(true)
    setInlineError(null)
    try {
      let addressId: string | undefined
      if (fulfillment === "DELIVERY" && user && addressMode === "new") {
        const created = await addressesApi.create({
          label: `Delivery · ${zone || "Nairobi"}`,
          text: addressText.trim(),
          area: zone || undefined,
          notes: deliveryNotes.trim() || undefined,
          ...(deliveryCoordinates ? { latitude: deliveryCoordinates.latitude, longitude: deliveryCoordinates.longitude } : {}),
        })
        addressId = created.id
        setSelectedAddressId(created.id)
      } else if (fulfillment === "DELIVERY" && user && addressMode === "saved") {
        addressId = selectedAddressId ?? undefined
      }
      const order = await ordersApi.create(buildPayload(paymentMethod, addressId))
      setPlacedOrder(order)
      if (order.pointsRedeemed > 0) {
        toast.success(`${order.pointsRedeemed} Sphere Points redeemed`)
      }
      // keep the session's point balance fresh (redemption already decremented server-side)
      void refreshSession()
      return order
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't place your order — please try again."
      setInlineError(msg)
      toast.error(msg)
      return null
    } finally {
      setPlacing(false)
    }
  }

  async function finalizeSuccess(message: string) {
    setPaymentPhase("select")
    setFailureMessage(null)
    setStep(4)
    toast.success(message)
    // refetch so the success screen reflects the completed payment
    // (status/payments/points from the server, not the pre-payment snapshot)
    if (placedOrder) {
      try {
        const updated = await ordersApi.get(placedOrder.id)
        setPlacedOrder(updated)
        void refreshSession() // loyalty balance changed if points were earned/redeemed
      } catch {
        /* keep the optimistic snapshot if the refetch fails */
      }
    }
  }

  async function changeMethod() {
    if (placedOrder) {
      try {
        await ordersApi.cancel(placedOrder.id, "Customer switched payment method before paying")
        // cancelled orders re-credit redeemed points server-side — refresh the balance
        void refreshSession()
      } catch {
        /* best-effort cancel of the unpaid order */
      }
      setPlacedOrder(null)
    }
    setPaymentPhase("select")
    setFailureMessage(null)
  }

  async function startMpesa() {
    setFailureMessage(null)
    const phone = normalizePhone(mpesaPhone)
    if (!phone) {
      setInlineError("Enter a valid Safaricom number, e.g. 0712 345 678.")
      return
    }
    setInlineError(null)
    const order = placedOrder ?? (await placeOrder("MPESA"))
    if (!order) return
    setPaying(true)
    try {
      const init = await paymentsApi.mpesaInitiate(order.id, phone)
      setCheckoutRequestId(init.checkoutRequestId)
      setPin("")
      setPaymentPhase("awaiting_pin")
      setPinDialogOpen(true)

      // Start automatic real-time status polling for phone STK prompt
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await paymentsApi.mpesaQuery(init.checkoutRequestId)
          if (res.status === "SUCCESS") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            setPinDialogOpen(false)
            finalizeSuccess("M-Pesa payment confirmed — thank you!")
          } else if (res.status === "FAILED") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            setPinDialogOpen(false)
            setPaymentPhase("failed")
            setFailureMessage(res.payment?.failureReason || "M-Pesa payment was declined or timed out.")
          }
        } catch {
          // ignore transient polling errors
        }
      }, 2500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't start the M-Pesa payment."
      setPaymentPhase("failed")
      setFailureMessage(msg)
      toast.error(msg)
    } finally {
      setPaying(false)
    }
  }

  async function confirmPin() {
    if (pin.length !== 4 || !placedOrder || !checkoutRequestId) return
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    setPaying(true)
    // demo convention: 1234 / 0000 simulate a wrong PIN → FAILED, any other code approves
    const result: "SUCCESS" | "FAILED" = pin === "1234" || pin === "0000" ? "FAILED" : "SUCCESS"
    try {
      await paymentsApi.mpesaCallback(checkoutRequestId, result, pin)
      setPinDialogOpen(false)
      if (result === "SUCCESS") {
        finalizeSuccess("Payment received — thank you!")
      } else {
        setPaymentPhase("failed")
        setFailureMessage("M-Pesa PIN rejected — the payment request was cancelled. Retry the STK push or choose another method.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't confirm the payment."
      toast.error(msg)
      setPinDialogOpen(false)
      setPaymentPhase("failed")
      setFailureMessage(msg)
    } finally {
      setPaying(false)
    }
  }

  async function startCard() {
    setFailureMessage(null)
    const cardError = validateCard(card)
    if (cardError) {
      setInlineError(cardError)
      return
    }
    setInlineError(null)
    const order = placedOrder ?? (await placeOrder("CARD"))
    if (!order) return
    setPaying(true)
    try {
      const res = await paymentsApi.cardInitiate(order.id, {
        number: card.number.replace(/[\s-]/g, ""),
        name: card.name.trim(),
        expiry: card.expiry.trim(),
        cvv: card.cvv.trim(),
      })
      if (res.status === "SUCCESS") {
        finalizeSuccess("Card payment approved via IntaSend — thank you!")
      } else if (res.status === "REQUIRES_3DS" && res.redirectUrl) {
        toast.info("Redirecting for 3D Secure verification...")
        window.location.href = res.redirectUrl
      } else {
        setPaymentPhase("failed")
        setFailureMessage(res.failureReason ?? "Card declined. Please check the card details or try another method.")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Card payment failed."
      setPaymentPhase("failed")
      setFailureMessage(msg)
      toast.error(msg)
    } finally {
      setPaying(false)
    }
  }

  async function startCash() {
    setFailureMessage(null)
    const order = placedOrder ?? (await placeOrder("CASH"))
    if (!order) return
    finalizeSuccess(
      fulfillment === "PICKUP" ? "Order placed — pay on pickup!" : "Order placed — pay on delivery!"
    )
  }

  async function startLater() {
    setFailureMessage(null)
    const order = placedOrder ?? (await placeOrder("LATER"))
    if (!order) return
    finalizeSuccess("Reservation placed — pay in store when collecting!")
  }

  function continueFrom2() {
    setInlineError(null)
    if (!user) {
      if (guestName.trim().length < 2) {
        setInlineError("Please enter your full name.")
        return
      }
      if (!normalizePhone(guestPhone)) {
        setInlineError("Please enter a valid Kenyan phone number, e.g. 0712 345 678.")
        return
      }
      if (hasRx) {
        setInlineError("Prescription items require an account so the pharmacist can review and track your prescription.")
        return
      }
    }
    if (fulfillment === "DELIVERY") {
      if (!zone) {
        setInlineError("Choose your delivery zone first (step 1).")
        setStep(1)
        return
      }
      if (user && addressMode === "saved" && !selectedAddressId) {
        setInlineError("Select a saved address or enter a new one.")
        return
      }
      if (!user && addressText.trim().length < 8) {
        setInlineError("Enter your delivery address — building, street and estate help our rider find you.")
        return
      }
      if (user && addressMode === "new" && addressText.trim().length < 8) {
        setInlineError("Enter your delivery address — building, street and estate help our rider find you.")
        return
      }
    }
    if (hasRx && uploaded.length === 0) {
      setInlineError("Upload at least one prescription file — payment is unlocked once the pharmacist has your prescription.")
      return
    }
    setStep(3)
  }

  function copyReference() {
    if (!placedOrder) return
    void navigator.clipboard?.writeText(placedOrder.reference).then(() => {
      setCopied(true)
      toast.success("Order reference copied")
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ---------- derived ----------
  // (selectedAddress is computed above, before the zone-sync effect)

  // ============================== RENDER ==============================

  return (
    <div className="pb-10">
      <Toaster position="bottom-left" richColors closeButton />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasRx
            ? `Includes ${rxCount} prescription item${rxCount === 1 ? "" : "s"} — pharmacist review before dispensing.`
            : "Pickup on Lumumba Drive or delivery to your door."}
        </p>

        {/* stepper */}
        <ol className="mt-6 flex items-center gap-1 overflow-x-auto sm:gap-2" aria-label="Checkout steps">
          {STEPS.map((s, i) => {
            const done = step > s.id || (step === 4 && s.id === 4)
            const current = step === s.id
            return (
              <li key={s.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <button
                  onClick={() => goTo(s.id)}
                  disabled={placedOrder != null || s.id >= step}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    current ? "border-primary/60 bg-primary/5" : done ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30" : "border-dashed",
                    !placedOrder && done ? "cursor-pointer hover:bg-accent/60" : "cursor-default"
                  )}
                  aria-current={current ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-bold",
                      current
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" aria-hidden /> : <s.icon className="h-4 w-4" aria-hidden />}
                  </span>
                  <span className="hidden min-w-0 sm:block">
                    <span className={cn("block truncate text-sm font-semibold", current && "text-primary")}>{s.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{s.hint}</span>
                  </span>
                  <span className="sm:hidden truncate text-xs font-semibold">{s.label}</span>
                </button>
                {i < STEPS.length - 1 ? <ChevronLeft className="hidden h-4 w-4 shrink-0 rotate-180 text-muted-foreground/40 sm:block" aria-hidden /> : null}
              </li>
            )
          })}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            {inlineError ? (
              <Alert variant="destructive" className="mb-4" role="alert">
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription>{inlineError}</AlertDescription>
              </Alert>
            ) : null}

            {step === 1 ? (
              <Card>
                <CardContent className="p-5 sm:p-6">
                  <h2 className="text-lg font-bold">How would you like to get your order?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">You can change this later before paying.</p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <FulfillmentCard
                      selected={fulfillment === "PICKUP"}
                      onSelect={() => setFulfillment("PICKUP")}
                      icon={Store}
                      title="Pickup at the shop"
                      badge="Free"
                      lines={["Lumumba Drive, Roysambu", "Ready in ~2 hours", "You get a pickup code to quote at the counter"]}
                    />
                    <FulfillmentCard
                      selected={fulfillment === "DELIVERY"}
                      onSelect={() => setFulfillment("DELIVERY")}
                      icon={Truck}
                      title="Delivery to you"
                      badge={freeOver != null ? `Free over ${formatKES(freeOver)}` : "Zone fees"}
                      lines={[
                        `Roysambu/TRM from ${formatKES(zones[0]?.fee ?? 150)}`,
                        "Other Nairobi areas by zone",
                        settings?.nightDelivery ? "Night delivery available" : "Daytime delivery, daily 8:00 AM – 10:30 PM",
                      ]}
                    />
                  </div>

                  {fulfillment === "DELIVERY" ? (
                    <div className="mt-5 space-y-4 rounded-xl border bg-muted/30 p-4">
                      <div>
                        <Label htmlFor="zone" className="text-sm font-semibold">
                          Delivery zone
                        </Label>
                        <p className="mb-2 text-xs text-muted-foreground">Fees are set per zone — we&apos;ll confirm the exact fee before payment.</p>
                        <Select value={zone || undefined} onValueChange={(v) => setZone(v)}>
                          <SelectTrigger id="zone" className="w-full" aria-label="Delivery zone">
                            <SelectValue placeholder="Choose your area…" />
                          </SelectTrigger>
                          <SelectContent>
                            {zones.map((z) => (
                              <SelectItem key={z.name} value={z.name}>
                                {z.name} — {formatKES(z.fee)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {zone ? (
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Badge variant="outline" className="bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                            <Truck className="mr-1 h-3 w-3" aria-hidden />
                            {zone}
                          </Badge>
                          {freeEligible ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Check className="mr-1 h-3 w-3" aria-hidden /> Free delivery unlocked
                            </Badge>
                          ) : (
                            <>
                              <span className="text-muted-foreground">Delivery fee:</span>
                              <span className="font-bold">{feeInfo || fallbackFee != null ? formatKES(deliveryFee ?? 0) : "…"}</span>
                              {freeOver != null ? (
                                <span className="text-xs text-muted-foreground">
                                  · add {formatKES(Math.max(0, freeOver - subtotal))} more for free delivery
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-5 flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <p>
                        Collect at <strong>{PHARMACY.name}</strong>, {PHARMACY.address}. {PHARMACY.hoursLabel} — you&apos;ll
                        receive a <strong>pickup code</strong> once your order is ready (usually within 2 hours).
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <Button size="lg" className="h-12 gap-2 rounded-full px-8" onClick={() => { setInlineError(null); setStep(2) }}>
                      Continue <ChevronLeft className="h-4 w-4 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 2 ? (
              <Card>
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <div>
                    <h2 className="text-lg font-bold">Your details</h2>
                    <p className="mt-1 text-sm text-muted-foreground">We use these to confirm your order and reach you if anything needs clarifying.</p>
                  </div>

                  {user ? (
                    <div className="flex items-start gap-3 rounded-xl border bg-emerald-50/60 p-4 dark:bg-emerald-950/30">
                      <User className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{user.name ?? "Signed-in customer"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.phone ?? "—"} {user.email ? `· ${user.email}` : ""} · logged in
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="checkout-name">Full name *</Label>
                        <Input
                          id="checkout-name"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="e.g. Amina Yusuf"
                          autoComplete="name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="checkout-phone">Phone number (M-Pesa) *</Label>
                        <Input
                          id="checkout-phone"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="0712 345 678"
                          inputMode="tel"
                          autoComplete="tel"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="checkout-email">Email (optional)</Label>
                        <Input
                          id="checkout-email"
                          type="email"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="you@example.com"
                          autoComplete="email"
                        />
                      </div>

                      {hasRx ? (
                        <div className="sm:col-span-2">
                          <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 [&>svg]:text-amber-600">
                            <FileWarning className="h-4 w-4" />
                            <AlertTitle>Prescription items need an account</AlertTitle>
                            <AlertDescription className="text-amber-800 dark:text-amber-300">
                              Our pharmacist reviews prescriptions against your account before dispensing. Log in or
                              register — it takes under a minute and keeps your history.
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button size="sm" className="rounded-full" onClick={() => openAuth("login", "checkout", "Log in to continue your prescription order.")}>
                                  Log in
                                </Button>
                                <Button size="sm" variant="outline" className="rounded-full" onClick={() => openAuth("register", "checkout")}>
                                  Create account
                                </Button>
                              </div>
                            </AlertDescription>
                          </Alert>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {fulfillment === "DELIVERY" ? (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Delivery address</h3>

                      {user ? (
                        addresses == null ? (
                          <div className="space-y-2">
                            <Skeleton className="h-16 w-full rounded-xl" />
                            <Skeleton className="h-16 w-full rounded-xl" />
                          </div>
                        ) : (
                          <>
                            {addresses.length > 0 ? (
                              <RadioGroup
                                value={addressMode === "saved" ? (selectedAddressId ?? "") : "new"}
                                onValueChange={(v) => (v === "new" ? setAddressMode("new") : setAddressMode("saved"))}
                                className="gap-3"
                              >
                                {addresses.map((a) => (
                                  <label
                                    key={a.id}
                                    className={cn(
                                      "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5",
                                      addressMode === "saved" && selectedAddressId === a.id ? "border-primary bg-primary/5" : "hover:bg-accent/40"
                                    )}
                                  >
                                    <RadioGroupItem value={a.id} id={`addr-${a.id}`} className="mt-1" />
                                    <span className="min-w-0 flex-1" onClickCapture={() => { setAddressMode("saved"); selectSavedAddress(a) }}>
                                      <span className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{a.label}</span>
                                        {a.isDefault ? <Badge variant="outline" className="text-[10px]">Default</Badge> : null}
                                      </span>
                                      <span className="mt-0.5 block text-sm text-muted-foreground">{a.text}</span>
                                      {a.area ? <span className="mt-0.5 block text-xs text-muted-foreground">Zone: {a.area.trim()}</span> : null}
                                    </span>
                                  </label>
                                ))}

                                <label
                                  className={cn(
                                    "flex cursor-pointer items-start gap-3 rounded-xl border border-dashed p-4 transition-colors",
                                    addressMode === "new" ? "border-primary bg-primary/5" : "hover:bg-accent/40"
                                  )}
                                >
                                  <RadioGroupItem value="new" id="addr-new" className="mt-1" />
                                  <span className="min-w-0 flex-1">
                                    <span className="text-sm font-semibold">Deliver somewhere new</span>
                                    <span className="mt-0.5 block text-xs text-muted-foreground">Enter a fresh address for this order</span>
                                  </span>
                                </label>
                              </RadioGroup>
                            ) : null}

                            {(addressMode === "new" || addresses.length === 0) && (
                              <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <Label htmlFor="new-address">Address (building, street, estate) *</Label>
                                  <UseCurrentLocationButton onResolved={(location) => {
                                    setAddressText(location.displayName)
                                    setDeliveryCoordinates({ latitude: location.latitude, longitude: location.longitude })
                                    const matched = zones.find((candidate) => {
                                      const value = (location.area || "").toLowerCase()
                                      return value && (value.includes(candidate.name.toLowerCase()) || candidate.name.toLowerCase().includes(value))
                                    })
                                    if (matched) setZone(matched.name)
                                  }} />
                                </div>
                                <Textarea
                                  id="new-address"
                                  value={addressText}
                                  onChange={(e) => setAddressText(e.target.value)}
                                  placeholder="e.g. Apmt 4B, Sunrise Court, Lumumba Drive, Roysambu — near TRM"
                                  rows={3}
                                />
                                <div className="space-y-2">
                                  <Label htmlFor="new-zone">Zone</Label>
                                  <Select value={zone || undefined} onValueChange={(v) => setZone(v)}>
                                    <SelectTrigger id="new-zone" className="w-full" aria-label="Delivery zone for new address">
                                      <SelectValue placeholder="Choose your area…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {zones.map((z) => (
                                        <SelectItem key={z.name} value={z.name}>
                                          {z.name} — {formatKES(z.fee)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </>
                        )
                      ) : (
                        <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Label htmlFor="guest-address">Address (building, street, estate) *</Label>
                            <UseCurrentLocationButton onResolved={(location) => {
                              setAddressText(location.displayName)
                              const matched = zones.find((candidate) => {
                                const value = (location.area || "").toLowerCase()
                                return value && (value.includes(candidate.name.toLowerCase()) || candidate.name.toLowerCase().includes(value))
                              })
                              if (matched) setZone(matched.name)
                            }} />
                          </div>
                          <Textarea
                            id="guest-address"
                            value={addressText}
                            onChange={(e) => setAddressText(e.target.value)}
                            placeholder="e.g. Apmt 4B, Sunrise Court, Lumumba Drive, Roysambu — near TRM"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground">
                            Delivering to <strong>{zone || (settings?.pricingMode === "distance" && deliveryCoordinates ? "Distance calculated automatically" : "— choose zone in step 1 —")}</strong>
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="delivery-notes">Notes for the rider (optional)</Label>
                        <Textarea
                          id="delivery-notes"
                          value={deliveryNotes}
                          onChange={(e) => setDeliveryNotes(e.target.value)}
                          placeholder="e.g. Call on arrival, gate code 4321, leave with the guard…"
                          rows={2}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm">
                      <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <p>
                        No address needed — collect at <strong>{PHARMACY.address}</strong>. Quote your pickup code at
                        the counter.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="order-notes">Order notes (optional)</Label>
                    <Textarea
                      id="order-notes"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Anything we should know — preferred brand, substitution OK, call before dispensing…"
                      rows={2}
                    />
                  </div>

                  {hasRx ? (
                    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
                      <div className="flex items-start gap-3">
                        <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                        <div>
                          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                            Prescription required ({rxCount} Rx item{rxCount === 1 ? "" : "s"})
                          </h3>
                          <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
                            Upload a photo or PDF of your prescription — our pharmacist verifies it before dispensing.
                            At least one file is required to unlock payment.
                          </p>
                        </div>
                      </div>

                      {uploaded.length > 0 ? (
                        <ul className="space-y-2">
                          {uploaded.map((u) => (
                            <li key={u.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{u.fileName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Uploaded · pending pharmacist review{u.notes ? ` · “${u.notes}”` : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => setUploaded((prev) => prev.filter((x) => x.id !== u.id))}
                                className="rounded-full p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                aria-label={`Remove ${u.fileName}`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-lg border border-dashed bg-card/60 p-3 text-center text-xs text-muted-foreground">
                          No prescriptions uploaded yet — required before payment.
                        </p>
                      )}

                      {staged.length > 0 ? (
                        <ul className="space-y-2">
                          {staged.map((s) => (
                            <li key={s.key} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                              {s.fileType.startsWith("image/") ? (
                                <img src={s.dataUrl} alt={`Preview of ${s.fileName}`} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                              ) : (
                                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted">
                                  <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
                                </span>
                              )}
                              <div className="min-w-0 flex-1 space-y-2">
                                <p className="truncate text-sm font-semibold">{s.fileName}</p>
                                <Input
                                  value={s.notes}
                                  onChange={(e) =>
                                    setStaged((prev) => prev.map((x) => (x.key === s.key ? { ...x, notes: e.target.value } : x)))
                                  }
                                  placeholder="Notes for the pharmacist (optional)"
                                  className="h-8 text-xs"
                                  aria-label={`Notes for ${s.fileName}`}
                                />
                              </div>
                              <button
                                onClick={() => setStaged((prev) => prev.filter((x) => x.key !== s.key))}
                                className="rounded-full p-1.5 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                                aria-label={`Remove ${s.fileName} before upload`}
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {rxError ? <p className="text-xs font-medium text-rose-600" role="alert">{rxError}</p> : null}

                      <div className="flex flex-wrap gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          onChange={handleFiles}
                          className="sr-only"
                          aria-label="Choose prescription files"
                          id="rx-file-input"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 rounded-full"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          <Upload className="h-4 w-4" /> {staged.length > 0 ? "Add another file" : "Choose file(s)"}
                        </Button>
                        {staged.length > 0 ? (
                          <Button type="button" size="sm" className="gap-1.5 rounded-full" onClick={uploadStaged} disabled={uploading}>
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                            {uploading ? "Uploading…" : `Upload ${staged.length} file${staged.length === 1 ? "" : "s"}`}
                          </Button>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Photos or PDF · up to 10MB each · multiple prescriptions welcome.</p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-between gap-2 pt-2">
                    <Button variant="ghost" size="lg" className="gap-1.5 rounded-full" onClick={() => { setInlineError(null); setStep(1) }}>
                      <ChevronLeft className="h-4 w-4" /> Back
                    </Button>
                    <Button size="lg" className="h-12 gap-2 rounded-full px-8" onClick={continueFrom2}>
                      Continue to payment <ChevronLeft className="h-4 w-4 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 3 ? (
              <Card>
                <CardContent className="space-y-6 p-5 sm:p-6">
                  <div>
                    <h2 className="text-lg font-bold">Payment</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {placedOrder
                        ? `Order ${placedOrder.reference} is placed — complete payment below.`
                        : "Choose how you'd like to pay. Your order is created when you confirm."}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                    <MethodCard
                      selected={method === "MPESA"}
                      onSelect={() => { setMethod("MPESA"); setFailureMessage(null) }}
                      icon={Phone}
                      title="M-Pesa"
                      subtitle="STK push to your phone"
                      badge="Popular"
                    />
                    <MethodCard
                      selected={method === "CARD"}
                      onSelect={() => { setMethod("CARD"); setFailureMessage(null) }}
                      icon={CreditCard}
                      title="Card"
                      subtitle="Visa / Mastercard via IntaSend"
                    />
                    <MethodCard
                      selected={method === "CASH"}
                      onSelect={() => { setMethod("CASH"); setFailureMessage(null) }}
                      icon={Banknote}
                      title="Cash"
                      subtitle={fulfillment === "PICKUP" ? "Pay when you collect" : "Pay the rider on delivery"}
                    />
                    <MethodCard
                      selected={method === "LATER"}
                      onSelect={() => { setMethod("LATER"); setFailureMessage(null) }}
                      icon={Hourglass}
                      title="Reserve"
                      subtitle="Pay in store within 24h"
                      badge="No card needed"
                    />
                  </div>

                  {paymentPhase === "failed" && failureMessage ? (
                    <Alert variant="destructive" role="alert">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertTitle>Payment didn&apos;t go through</AlertTitle>
                      <AlertDescription>
                        {failureMessage}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="rounded-full" onClick={changeMethod}>
                            Choose another method
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {method === "MPESA" ? (
                    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                      <div className="space-y-2">
                        <Label htmlFor="mpesa-phone">M-Pesa phone number</Label>
                        <Input
                          id="mpesa-phone"
                          value={mpesaPhone}
                          onChange={(e) => setMpesaPhone(e.target.value)}
                          placeholder="0712 345 678"
                          inputMode="tel"
                          autoComplete="tel"
                        />
                        <p className="text-xs text-muted-foreground">
                          We&apos;ll send an STK push to this number — just enter your M-Pesa PIN when prompted.
                        </p>
                      </div>
                      <Button size="lg" className="h-12 w-full gap-2 rounded-full text-base" onClick={startMpesa} disabled={placing || paying}>
                        {placing || paying ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Phone className="h-5 w-5" aria-hidden />}
                        {placing ? "Placing order…" : paying ? "Sending STK push…" : `Pay ${formatKES(payableTotal)} with M-Pesa`}
                      </Button>
                    </div>
                  ) : null}

                  {method === "CARD" ? (
                    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="card-number">Card number</Label>
                          <Input
                            id="card-number"
                            value={card.number}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "").slice(0, 16)
                              setCard((c) => ({ ...c, number: digits.replace(/(.{4})/g, "$1 ").trim() }))
                            }}
                            placeholder="4242 4242 4242 4242"
                            inputMode="numeric"
                            autoComplete="cc-number"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="card-name">Name on card</Label>
                          <Input
                            id="card-name"
                            value={card.name}
                            onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                            placeholder="AMINA YUSUF"
                            autoComplete="cc-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="card-expiry">Expiry (MM/YY)</Label>
                          <Input
                            id="card-expiry"
                            value={card.expiry}
                            onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiryInput(e.target.value) }))}
                            placeholder="09/27"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="card-cvv">CVV</Label>
                          <Input
                            id="card-cvv"
                            value={card.cvv}
                            onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                            placeholder="123"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                          />
                        </div>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="h-3.5 w-3.5" aria-hidden /> Secured via IntaSend · card details are never stored
                      </p>
                      <Button size="lg" className="h-12 w-full gap-2 rounded-full text-base" onClick={startCard} disabled={placing || paying}>
                        {placing || paying ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
                        {placing ? "Placing order…" : paying ? "Processing card…" : `Pay ${formatKES(payableTotal)} with card`}
                      </Button>
                    </div>
                  ) : null}

                  {method === "CASH" ? (
                    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                      <p className="text-sm text-muted-foreground">
                        {fulfillment === "PICKUP"
                          ? "Place the order now and pay at the counter when you collect. We'll have it bagged and waiting."
                          : "Place the order now and pay the rider on delivery — please have exact change if possible."}
                      </p>
                      <Button size="lg" className="h-12 w-full gap-2 rounded-full text-base" onClick={startCash} disabled={placing || paying}>
                        {placing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Banknote className="h-5 w-5" aria-hidden />}
                        {placing ? "Placing order…" : `Place order · ${formatKES(payableTotal)}`}
                      </Button>
                    </div>
                  ) : null}

                  {method === "LATER" ? (
                    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
                      <p className="text-sm text-muted-foreground">
                        We&apos;ll reserve your items for <strong>24 hours</strong> — pay in store within that window and
                        quote your order reference. Unclaimed reservations are released after 24h.
                      </p>
                      <Button size="lg" className="h-12 w-full gap-2 rounded-full text-base" onClick={startLater} disabled={placing || paying}>
                        {placing ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Hourglass className="h-5 w-5" aria-hidden />}
                        {placing ? "Placing order…" : "Reserve items · pay in store"}
                      </Button>
                    </div>
                  ) : null}

                  <div className="flex justify-between pt-1">
                    <Button
                      variant="ghost"
                      size="lg"
                      className="gap-1.5 rounded-full"
                      onClick={() => {
                        setInlineError(null)
                        if (placedOrder) {
                          void changeMethod()
                        }
                        setStep(2)
                      }}
                      disabled={placing || paying}
                    >
                      <ChevronLeft className="h-4 w-4" /> Back to details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {step === 4 && placedOrder ? (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col items-center bg-gradient-to-b from-emerald-50 to-transparent px-6 pb-8 pt-10 text-center dark:from-emerald-950/40">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                      <CheckCircle2 className="h-10 w-10" aria-hidden />
                    </span>
                    <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
                      {placedOrder.payments.some((p) => p.status === "SUCCESS")
                        ? "Payment received — order confirmed!"
                        : placedOrder.type === "RESERVATION"
                          ? "Items reserved!"
                          : "Order placed!"}
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      {placedOrder.payments.some((p) => p.status === "SUCCESS")
                        ? "We've received your payment. We're preparing your order and will notify you at every step."
                        : placedOrder.type === "RESERVATION"
                          ? "Your items are held for 24 hours — pay in store and quote your reference."
                          : "Our team confirms availability first; you pay on " +
                            (placedOrder.fulfillment === "PICKUP" ? "pickup." : "delivery.")}
                    </p>

                    <div className="mt-6 flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 shadow-sm">
                      <span className="font-mono text-lg font-bold tracking-wider">{placedOrder.reference}</span>
                      <button
                        onClick={copyReference}
                        className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label="Copy order reference"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>

                    {placedOrder.fulfillment === "PICKUP" && placedOrder.pickupCode ? (
                      <div className="mt-4 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 px-6 py-4 dark:border-emerald-700 dark:bg-emerald-950/40">
                        <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Pickup code</p>
                        <p className="mt-1 font-mono text-3xl font-black tracking-[0.3em] text-emerald-800 dark:text-emerald-200">
                          {placedOrder.pickupCode}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Quote this at the counter · {PHARMACY.address}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4 border-t p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Order summary</h3>
                    <ul className="space-y-2.5">
                      {placedOrder.items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="font-medium">
                              {it.qty} × {it.name}
                            </span>
                            {it.requiresPrescription ? <span className="ml-1.5 text-xs text-rose-600">℞</span> : null}
                          </span>
                          <span className="shrink-0 font-semibold">{formatKES(it.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                    <Separator />
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span className="tnum">{formatKES(placedOrder.subtotal)}</span>
                      </div>
                      {placedOrder.discountAmount > 0 ? (
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                          <span>Promo {placedOrder.promotionCode}</span>
                          <span className="tnum font-semibold">−{formatKES(placedOrder.discountAmount)}</span>
                        </div>
                      ) : null}
                      {placedOrder.pointsRedeemed > 0 ? (
                        <div className="flex justify-between text-teal-700 dark:text-teal-400">
                          <span>Sphere Points ({placedOrder.pointsRedeemed} pts)</span>
                          <span className="tnum font-semibold">−{formatKES(placedOrder.pointsRedeemed * LOYALTY.pointValue)}</span>
                        </div>
                      ) : null}
                      <div className="flex justify-between text-muted-foreground">
                        <span>{placedOrder.fulfillment === "PICKUP" ? "Pickup" : `Delivery · ${placedOrder.deliveryArea ?? ""}`}</span>
                        <span className="tnum">{placedOrder.deliveryFee === 0 ? "Free" : formatKES(placedOrder.deliveryFee)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold">
                        <span>Total</span>
                        <span className="tnum text-primary">{formatKES(placedOrder.total)}</span>
                      </div>
                    </div>

                    {(placedOrder.pointsRedeemed > 0 || pointsForEarnEstimate > 0) ? (
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-teal-200 bg-teal-50/70 p-2.5 text-xs text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {placedOrder.pointsRedeemed > 0 ? (
                          <span className="font-semibold">{placedOrder.pointsRedeemed} Sphere Points redeemed (−{formatKES(placedOrder.pointsRedeemed * LOYALTY.pointValue)})</span>
                        ) : null}
                        {pointsForEarnEstimate > 0 ? (
                          <span>You&apos;ll earn ~{pointsForEarnEstimate} pts on this order — 1 pt per KSh {LOYALTY.earnPerKES} spent.</span>
                        ) : null}
                      </p>
                    ) : null}

                    {placedOrder.prescriptions.length > 0 ? (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        <FileWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <p>
                          {placedOrder.prescriptions.length} prescription{placedOrder.prescriptions.length === 1 ? "" : "s"} attached —
                          a pharmacist reviews {placedOrder.prescriptions.length === 1 ? "it" : "them"} before dispensing. We&apos;ll
                          call if anything needs clarifying.
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button size="lg" className="h-12 flex-1 gap-2 rounded-full" onClick={() => navigate("order", { orderId: placedOrder.id })}>
                        <Package className="h-5 w-5" /> Track order
                      </Button>
                      <Button size="lg" variant="outline" className="h-12 flex-1 gap-2 rounded-full" onClick={() => navigate("home")}>
                        Continue shopping
                      </Button>
                    </div>

                    <p className="flex flex-wrap items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      Questions about this order?{" "}
                      <a
                        href={waLink(`Hello! I have a question about order ${placedOrder.reference}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                      >
                        WhatsApp us
                      </a>{" "}
                      or call {PHARMACY.phoneDisplay}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <aside aria-label="Order summary">
            <Card className="sticky top-36">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-base font-bold">Order summary</h2>

                <ul className="scroll-slim max-h-56 space-y-2.5 overflow-y-auto pr-1 text-sm">
                  {(placedOrder
                    ? placedOrder.items.map((it) => ({ key: it.id, name: it.name, qty: it.qty, lineTotal: it.lineTotal, requiresPrescription: it.requiresPrescription }))
                    : lines.map((l) => ({ key: l.productId, name: l.name, qty: l.qty, lineTotal: l.price * l.qty, requiresPrescription: l.requiresPrescription }))
                  ).map((row) => (
                    <li key={row.key} className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {row.qty} × {row.name}
                        </span>
                        {row.requiresPrescription ? <span className="text-xs text-rose-600">℞ prescription item</span> : null}
                      </span>
                      <span className="shrink-0 font-semibold">{formatKES(row.lineTotal)}</span>
                    </li>
                  ))}
                </ul>

                {hasRx && step < 4 ? (
                  <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <FileWarning className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {uploaded.length > 0
                      ? `${uploaded.length} prescription${uploaded.length === 1 ? "" : "s"} uploaded · pending review`
                      : "Prescription upload required at step 2"}
                  </p>
                ) : null}

                <Separator />

                {placedOrder ? (
                  placedOrder.promotionCode ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
                      <span className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                        <Ticket className="h-4 w-4" aria-hidden /> {placedOrder.promotionCode}
                      </span>
                      <span className="tnum font-bold text-emerald-700 dark:text-emerald-300">−{formatKES(placedOrder.discountAmount)}</span>
                    </div>
                  ) : null
                ) : promo ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
                    <span className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                      <Ticket className="h-4 w-4" aria-hidden /> {promo.code} · {promo.discountPct}% off
                    </span>
                    <button onClick={removePromo} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Remove promo code">
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Ticket className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                        <Input
                          value={promoInput}
                          onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null) }}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void applyPromo())}
                          placeholder="Promo code"
                          className="h-10 pl-9 text-sm uppercase tracking-wide"
                          aria-label="Promo code"
                          enterKeyHint="done"
                        />
                      </div>
                      <Button variant="outline" className="h-10" onClick={() => void applyPromo()} disabled={promoBusy || !promoInput.trim()}>
                        {promoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    {promoError ? <p className="text-xs text-destructive">{promoError}</p> : null}
                  </div>
                )}

                {!placedOrder && user && loyaltyBalance >= LOYALTY.minRedeem ? (
                  <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-800 dark:bg-teal-950/30">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-teal-800 dark:text-teal-200">Sphere Points</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Balance{" "}
                          <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">{loyaltyBalance} pts</span>
                          {" "}· ≈ {formatKES(loyaltyBalance * LOYALTY.pointValue)} · 1 pt = KSh {LOYALTY.pointValue}
                        </p>
                      </div>
                    </div>
                    {redeemQuote >= LOYALTY.minRedeem ? (
                      <div className="mt-2.5 flex items-center justify-between gap-3 rounded-lg border bg-card p-2.5">
                        <div className="min-w-0">
                          <Label htmlFor="redeem-points" className="cursor-pointer text-sm font-semibold">
                            Redeem {redeemQuote} pts (−{formatKES(redeemValue)})
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Max {LOYALTY.maxRedeemPct}% of this order · applied at payment
                          </p>
                        </div>
                        <Switch
                          id="redeem-points"
                          checked={redeemPoints}
                          onCheckedChange={setRedeemPoints}
                          aria-label={`Redeem ${redeemQuote} Sphere Points for ${formatKES(redeemValue)} off this order`}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        Orders from {formatKES(Math.ceil((LOYALTY.minRedeem * LOYALTY.pointValue * 100) / LOYALTY.maxRedeemPct))} qualify —
                        this order is still too small to redeem points.
                      </p>
                    )}
                  </div>
                ) : null}

                {!placedOrder && user && loyaltyBalance < LOYALTY.minRedeem ? (
                  <p className="flex items-start gap-1.5 rounded-lg border border-dashed bg-muted/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                    <span>
                      Sphere Points — earn 1 pt per KSh {LOYALTY.earnPerKES} spent, redeem from {LOYALTY.minRedeem} pts at
                      checkout. You have {loyaltyBalance} pt{loyaltyBalance === 1 ? "" : "s"} so far.
                    </span>
                  </p>
                ) : null}

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tnum font-semibold">{formatKES(placedOrder ? placedOrder.subtotal : subtotal)}</span>
                  </div>
                  {(placedOrder ? placedOrder.discountAmount > 0 : promo != null) ? (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>Promo discount</span>
                      <span className="tnum font-semibold">−{formatKES(placedOrder ? placedOrder.discountAmount : discountAmount)}</span>
                    </div>
                  ) : null}
                  {placedOrder ? (
                    placedOrder.pointsRedeemed > 0 ? (
                      <div className="flex justify-between text-teal-700 dark:text-teal-400">
                        <span>Sphere Points (−{placedOrder.pointsRedeemed} pts)</span>
                        <span className="tnum font-semibold">−{formatKES(placedOrder.pointsRedeemed * LOYALTY.pointValue)}</span>
                      </div>
                    ) : null
                  ) : redeemPoints && pointsEligible ? (
                    <div className="flex justify-between text-teal-700 dark:text-teal-400">
                      <span>Sphere Points (−{redeemQuote} pts)</span>
                      <span className="tnum font-semibold">−{formatKES(redeemValue)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{fulfillment === "PICKUP" ? "Pickup" : "Delivery"}</span>
                    <span className="tnum font-semibold">
                      {placedOrder
                        ? placedOrder.deliveryFee === 0
                          ? "Free"
                          : formatKES(placedOrder.deliveryFee)
                        : fulfillment === "PICKUP"
                          ? "Free"
                          : deliveryFee == null
                            ? "Choose zone"
                            : deliveryFee === 0
                              ? "Free"
                              : formatKES(deliveryFee)}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-baseline justify-between">
                  <span className="font-bold">Total</span>
                  <span className="text-xl font-extrabold text-primary">
                    {formatKES(payableTotal)}
                  </span>
                </div>

                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Payments are processed securely. Prescription items are dispensed only after pharmacist verification —
                  you&apos;ll be refunded if anything can&apos;t be fulfilled.
                </p>

                <a
                  href={waLink("Hello! I need help with my checkout on the Sphere Pharmacy website.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex"
                >
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-full">
                    <MessageCircle className="h-4 w-4 text-emerald-600" /> Need help? WhatsApp us
                  </Button>
                </a>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <Dialog open={pinDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setPinDialogOpen(false)
          if (paymentPhase === "awaiting_pin") setPaymentPhase("select")
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-emerald-600" aria-hidden /> Enter M-Pesa PIN
            </DialogTitle>
            <DialogDescription>
              STK push sent to <strong>{normalizePhone(mpesaPhone) ?? mpesaPhone}</strong>. Enter your PIN to authorise the
              payment of <strong>{formatKES(payableTotal)}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            <InputOTP maxLength={4} value={pin} onChange={setPin} disabled={paying}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            <p className="text-center text-xs text-muted-foreground">
              Demo: enter any 4-digit PIN to approve. Use <strong>1234</strong> or <strong>0000</strong> to simulate a
              wrong PIN.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full gap-2 rounded-full" onClick={confirmPin} disabled={pin.length !== 4 || paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              {paying ? "Authorising…" : `Authorise ${formatKES(payableTotal)}`}
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={() => {
                setPinDialogOpen(false)
                setPaymentPhase("select")
              }}
              disabled={paying}
            >
              Cancel STK push
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------- small building blocks ----------

function FulfillmentCard({
  selected, onSelect, icon: Icon, title, badge, lines,
}: {
  selected: boolean
  onSelect: () => void
  icon: typeof Truck
  title: string
  badge?: string
  lines: string[]
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex flex-col items-start rounded-xl border p-5 text-left transition-all",
        selected ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-accent/40"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        {badge ? (
          <Badge variant="outline" className={cn(selected ? "border-primary/40 text-primary" : "text-muted-foreground")}>
            {badge}
          </Badge>
        ) : null}
      </div>
      <span className="mt-3 text-base font-bold">{title}</span>
      <span className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        {lines.map((l) => (
          <span key={l} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
            {l}
          </span>
        ))}
      </span>
    </button>
  )
}

function MethodCard({
  selected, onSelect, icon: Icon, title, subtitle, badge,
}: {
  selected: boolean
  onSelect: () => void
  icon: typeof CreditCard
  title: string
  subtitle: string
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all",
        selected ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30" : "border-border hover:border-primary/40 hover:bg-accent/40"
      )}
    >
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-bold">{title}</span>
          {badge ? <Badge variant="outline" className="text-[10px]">{badge}</Badge> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3 text-primary-foreground" /> : null}
      </span>
    </button>
  )
}
