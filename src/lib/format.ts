import { ORDER_STATUS_LABELS, STOCK_LABELS, type OrderStatus, type StockStatus } from "./constants"

export function formatKES(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  return d.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function timeAgo(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(d)
}

export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] ?? status
}

export function stockLabel(status: StockStatus): string {
  return STOCK_LABELS[status] ?? status
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/** Is the pharmacy open right now, based on the 8:00–22:30 daily window? */
export function isOpenNow(): boolean {
  const now = new Date()
  const nairobi = new Date(now.getTime() + 0) // server-agnostic approximation
  const h = nairobi.getHours() + nairobi.getMinutes() / 60
  return h >= 8 && h < 22.5
}

export function shortRef(reference: string): string {
  return reference.replace(/^SPH-/, "")
}
