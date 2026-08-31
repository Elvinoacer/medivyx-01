"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { type OrderStatus, type RxStatus, type StockStatus, PAYMENT_STATUSES, type PaymentStatus, ORDER_STATUS_LABELS, RX_STATUS_LABELS, STOCK_LABELS } from "@/lib/constants"
import { statusLabel } from "@/lib/format"

// ---------- Status → semantic class maps ----------

const orderStatusStyles: Record<OrderStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  PRESCRIPTION_VERIFIED: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  AVAILABILITY_CONFIRMED: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  PAID: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  PREPARING: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  READY_FOR_PICKUP: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800",
  OUT_FOR_DELIVERY: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-950/60 dark:text-lime-300 dark:border-lime-800",
  COMPLETED_PICKUP: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  COMPLETED_DELIVERY: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  REFUNDED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
}

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", orderStatusStyles[status] ?? "", className)}>
      {statusLabel(status)}
    </Badge>
  )
}

// ---------- Prescription status ----------

const rxStatusStyles: Record<RxStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  CLARIFICATION_REQUESTED: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
  PARTIALLY_APPROVED: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
}

export function RxStatusBadge({ status, className }: { status: RxStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", rxStatusStyles[status] ?? "", className)}>
      {RX_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

// ---------- Stock status ----------

const stockStyles: Record<StockStatus, string> = {
  IN_STOCK: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  LOW_STOCK: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  OUT_OF_STOCK: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  DISCONTINUED: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
}

export function StockStatusBadge({ status, className }: { status: StockStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", stockStyles[status] ?? "", className)}>
      {STOCK_LABELS[status] ?? status}
    </Badge>
  )
}

// ---------- Payment status ----------

const paymentStyles: Record<PaymentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
  PROCESSING: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800",
  SUCCESS: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  FAILED: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
  REFUNDED: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-medium", paymentStyles[status] ?? "", className)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  )
}

// ---------- Rx flag badge ----------

export function RxFlagBadge({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Badge variant="outline" className={cn("bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800", className)}>
      <span aria-hidden>℞</span> {compact ? "Rx" : "Prescription required"}
    </Badge>
  )
}

export function OtcBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800", className)}>
      OTC
    </Badge>
  )
}

export { PAYMENT_STATUSES, ORDER_STATUS_LABELS }
