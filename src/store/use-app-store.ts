"use client"

// App view router store (single-page app at "/").
// MERGED CONTRACT (task 2-a): this file was missing from the foundation delivery
// (dev.log showed "Module not found: Can't resolve '@/store/use-app-store'").
// Task 2-c restored a view/params-based router; task 2-a's storefront views
// additionally need authMode/authNext/authMessage, resetCatalogFilters and
// selectedProductId/selectedOrderId mirrors. This file merges BOTH contracts so
// page.tsx, header, footer, product-card, assistant-widget, storefront views
// (2-a) and admin views (2-c) all compile against one store.

import { create } from "zustand"

export type ViewName =
  | "home"
  | "catalog"
  | "product"
  | "services"
  | "cart"
  | "checkout"
  | "auth"
  | "orders"
  | "order"
  | "prescriptions"
  | "account"
  | "admin"

/** Alias kept for storefront views that use the AppView name. */
export type AppView = ViewName

export type AuthMode = "login" | "register" | "otp" | "staff"

export interface ViewParams {
  productId?: string
  orderId?: string
  /** auth view: which sign-in tab to preselect ("login" | "register" | "otp" | "staff") */
  mode?: string
  /** auth view: view name to return to after successful sign-in */
  next?: string
  [key: string]: string | undefined
}

/** Alias kept for storefront views that use NavigateOptions. */
export type NavigateOptions = ViewParams

export interface CatalogFilters {
  search: string
  /** CategoryDTO.id; "" means all categories */
  category: string
  rx: "any" | "yes" | "no"
  availability: "any" | "in" | "low" | "out"
  sort: "popular" | "price-asc" | "price-desc" | "name" | "newest"
}

export type CatalogSort = CatalogFilters["sort"]

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  search: "",
  category: "",
  rx: "any",
  availability: "any",
  sort: "popular",
}

const AUTH_MODES: AuthMode[] = ["login", "register", "otp", "staff"]

function isAuthMode(v: unknown): v is AuthMode {
  return typeof v === "string" && (AUTH_MODES as string[]).includes(v)
}

interface HistoryEntry {
  view: ViewName
  params: ViewParams
}

interface AppState {
  view: ViewName
  params: ViewParams
  /** mirrors of params.productId / params.orderId for convenience */
  selectedProductId: string | null
  selectedOrderId: string | null
  assistantOpen: boolean
  catalogFilters: CatalogFilters
  history: HistoryEntry[]

  /** auth view state (set via openAuth or when navigating to "auth" with params.mode) */
  authMode: AuthMode
  authNext: ViewName | null
  authNextParams: ViewParams | null
  authMessage: string | null

  /** Navigate to a view (pushes onto the internal back-stack). */
  navigate: (view: ViewName, params?: ViewParams) => void
  /** Replace current view without pushing history. */
  replace: (view: ViewName, params?: ViewParams) => void
  /** Go back one entry in the internal back-stack (falls back to home). */
  goBack: () => void
  /** Convenience: open the auth view in a given mode, optionally returning to `next` (with params) after login. */
  openAuth: (mode?: AuthMode, next?: ViewName, message?: string, nextParams?: ViewParams) => void
  setAuthMode: (mode: AuthMode) => void
  clearAuthIntent: () => void
  setAssistantOpen: (open: boolean) => void
  setCatalogFilters: (filters: Partial<CatalogFilters>) => void
  resetCatalogFilters: () => void
}

function mirrorParams(params: ViewParams): Pick<AppState, "selectedProductId" | "selectedOrderId"> {
  return {
    selectedProductId: params.productId ?? null,
    selectedOrderId: params.orderId ?? null,
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  view: "home",
  params: {},
  selectedProductId: null,
  selectedOrderId: null,
  assistantOpen: false,
  catalogFilters: DEFAULT_CATALOG_FILTERS,
  history: [],

  authMode: "login",
  authNext: null,
  authNextParams: null,
  authMessage: null,

  navigate: (view, params = {}) => {
    const { view: currentView, params: currentParams, history } = get()
    if (currentView === view && JSON.stringify(currentParams) === JSON.stringify(params)) return
    const patch: Partial<AppState> = {
      view,
      params,
      history: [...history, { view: currentView, params: currentParams }].slice(-30),
      ...mirrorParams(params),
    }
    if (view === "auth") {
      if (isAuthMode(params.mode)) patch.authMode = params.mode
      if (params.next) patch.authNext = params.next as ViewName
    }
    set(patch)
    if (typeof window !== "undefined") window.scrollTo({ top: 0 })
  },

  replace: (view, params = {}) => {
    set({ view, params, ...mirrorParams(params) })
  },

  goBack: () => {
    const { history } = get()
    const last = history[history.length - 1]
    if (last) {
      set({ view: last.view, params: last.params, ...mirrorParams(last.params), history: history.slice(0, -1) })
    } else {
      set({ view: "home", params: {}, selectedProductId: null, selectedOrderId: null })
    }
    if (typeof window !== "undefined") window.scrollTo({ top: 0 })
  },

  openAuth: (mode = "login", next, message, nextParams) => {
    set({ authMode: mode, authNext: next ?? null, authNextParams: nextParams ?? null, authMessage: message ?? null })
    get().navigate("auth", { mode, next, ...nextParams })
  },

  setAuthMode: (mode) => set({ authMode: mode }),
  clearAuthIntent: () => set({ authNext: null, authNextParams: null, authMessage: null }),

  setAssistantOpen: (open) => set({ assistantOpen: open }),

  setCatalogFilters: (filters) => set({ catalogFilters: { ...get().catalogFilters, ...filters } }),

  resetCatalogFilters: () => set({ catalogFilters: { ...DEFAULT_CATALOG_FILTERS } }),
}))
