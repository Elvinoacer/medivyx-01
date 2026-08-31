"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// Wishlist — saved products, persisted locally. Works for guests and customers alike;
// the heart icon toggles save/unsave anywhere a product appears.

export interface WishItem {
  productId: string
  name: string
  price: number
  image: string | null
  requiresPrescription: boolean
  packSize: string | null
  brand: string | null
  savedAt: number
}

interface WishState {
  items: WishItem[]
  toggle: (item: Omit<WishItem, "savedAt">) => boolean // returns true when saved
  has: (productId: string) => boolean
  remove: (productId: string) => void
  clear: () => void
}

export const useWishStore = create<WishState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (item) => {
        const exists = get().items.some((w) => w.productId === item.productId)
        if (exists) {
          set({ items: get().items.filter((w) => w.productId !== item.productId) })
          return false
        }
        set({ items: [{ ...item, savedAt: Date.now() }, ...get().items].slice(0, 100) })
        return true
      },
      has: (productId) => get().items.some((w) => w.productId === productId),
      remove: (productId) => set({ items: get().items.filter((w) => w.productId !== productId) }),
      clear: () => set({ items: [] }),
    }),
    { name: "sphere-wishlist" }
  )
)

// Recently-viewed products — tracks the last 12 product pages opened,
// shown on the home page as a "pick up where you left off" row.

interface RecentState {
  ids: { productId: string; at: number }[]
  track: (productId: string) => void
  clear: () => void
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set, get) => ({
      ids: [],
      track: (productId) => {
        set({
          ids: [{ productId, at: Date.now() }, ...get().ids.filter((i) => i.productId !== productId)].slice(0, 12),
        })
      },
      clear: () => set({ ids: [] }),
    }),
    { name: "sphere-recent" }
  )
)
