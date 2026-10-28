"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { forgetOffer } from "@/lib/offer-intent"

export interface CartLine {
  productId: string
  name: string
  price: number
  image: string | null
  requiresPrescription: boolean
  packSize: string | null
  stockStatus: string
  qty: number
}

/** Only the intent is stored; discounts are always validated again by the server. */
export interface AppliedCartPromo {
  code: string
  minimumSpend: number | null
}

interface CartState {
  lines: CartLine[]
  appliedPromo: AppliedCartPromo | null
  add: (line: Omit<CartLine, "qty">, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
  setAppliedPromo: (promo: AppliedCartPromo) => void
  clearAppliedPromo: () => void
  count: () => number
  subtotal: () => number
  rxLines: () => CartLine[]
  otcLines: () => CartLine[]
}

function eligiblePromo(lines: CartLine[], promo: AppliedCartPromo | null): AppliedCartPromo | null {
  if (!promo || lines.length === 0) return null
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
  return promo.minimumSpend != null && subtotal < promo.minimumSpend ? null : promo
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      appliedPromo: null,
      add: (line, qty = 1) => {
        const existing = get().lines.find((l) => l.productId === line.productId)
        const nextLines = existing
          ? get().lines.map((l) =>
              l.productId === line.productId ? { ...l, qty: Math.min(99, l.qty + qty) } : l
            )
          : [...get().lines, { ...line, qty }]
        set((state) => ({ lines: nextLines, appliedPromo: eligiblePromo(nextLines, state.appliedPromo) }))
      },
      setQty: (productId, qty) => {
        const nextLines = qty <= 0
          ? get().lines.filter((l) => l.productId !== productId)
          : get().lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l))
        if (nextLines.length === 0) forgetOffer()
        set((state) => ({ lines: nextLines, appliedPromo: eligiblePromo(nextLines, state.appliedPromo) }))
      },
      remove: (productId) => {
        const nextLines = get().lines.filter((l) => l.productId !== productId)
        if (nextLines.length === 0) forgetOffer()
        set((state) => ({ lines: nextLines, appliedPromo: eligiblePromo(nextLines, state.appliedPromo) }))
      },
      clear: () => {
        forgetOffer()
        set({ lines: [], appliedPromo: null })
      },
      setAppliedPromo: (promo) => {
        const code = promo.code.trim().toUpperCase()
        if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return
        const minimumSpend = promo.minimumSpend != null && Number.isFinite(promo.minimumSpend)
          ? Math.max(0, promo.minimumSpend)
          : null
        set((state) => ({
          appliedPromo: eligiblePromo(state.lines, { code, minimumSpend }),
        }))
      },
      clearAppliedPromo: () => set({ appliedPromo: null }),
      count: () => get().lines.reduce((n, l) => n + l.qty, 0),
      subtotal: () => get().lines.reduce((s, l) => s + l.price * l.qty, 0),
      rxLines: () => get().lines.filter((l) => l.requiresPrescription),
      otcLines: () => get().lines.filter((l) => !l.requiresPrescription),
    }),
    { name: "sphere-cart", partialize: (state) => ({ lines: state.lines, appliedPromo: state.appliedPromo }) }
  )
)
