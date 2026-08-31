"use client"

import { create } from "zustand"
import type { SessionPayload } from "@/lib/types"

interface AuthState {
  session: SessionPayload | null
  loading: boolean
  setSession: (s: SessionPayload | null) => void
  setLoading: (v: boolean) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: true,
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  refresh: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" })
      const data = await res.json()
      set({ session: res.ok && data.user ? data : res.ok && data.staff ? data : null, loading: false })
    } catch {
      set({ session: null, loading: false })
    }
  },
  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } finally {
      set({ session: null })
    }
  },
}))
