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
      const token = localStorage.getItem("medivyx_device_token") || localStorage.getItem("sphere_device_token")
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      if (!response.ok) throw new Error("Could not sign out. Please try again.")
      localStorage.removeItem("medivyx_device_token")
      localStorage.removeItem("sphere_device_token")
      set({ session: null })
    } catch (error) {
      throw error
    }
  },
}))
