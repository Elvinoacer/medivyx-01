"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

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

interface CartState {
  lines: CartLine[]
  add: (line: Omit<CartLine, "qty">, qty?: number) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
  count: () => number
  subtotal: () => number
  rxLines: () => CartLine[]
  otcLines: () => CartLine[]
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      add: (line, qty = 1) => {
        const existing = get().lines.find((l) => l.productId === line.productId)
        if (existing) {
          set({
            lines: get().lines.map((l) =>
              l.productId === line.productId ? { ...l, qty: Math.min(99, l.qty + qty) } : l
            ),
          })
        } else {
          set({ lines: [...get().lines, { ...line, qty }] })
        }
      },
      setQty: (productId, qty) => {
        if (qty <= 0) {
          set({ lines: get().lines.filter((l) => l.productId !== productId) })
        } else {
          set({
            lines: get().lines.map((l) => (l.productId === productId ? { ...l, qty: Math.min(99, qty) } : l)),
          })
        }
      },
      remove: (productId) => set({ lines: get().lines.filter((l) => l.productId !== productId) }),
      clear: () => set({ lines: [] }),
      count: () => get().lines.reduce((n, l) => n + l.qty, 0),
      subtotal: () => get().lines.reduce((s, l) => s + l.price * l.qty, 0),
      rxLines: () => get().lines.filter((l) => l.requiresPrescription),
      otcLines: () => get().lines.filter((l) => !l.requiresPrescription),
    }),
    { name: "sphere-cart" }
  )
)
