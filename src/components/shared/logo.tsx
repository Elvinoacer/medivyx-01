"use client"

import { cn } from "@/lib/utils"

/** Sphere Pharmacy brand mark: a stylised cross inside a sphere ring. */
export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" />
      <circle cx="24" cy="24" r="14.5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <path d="M24 15.5v17M15.5 24h17" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  )
}

export function LogoFull({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden>
          <path d="M24 15.5v17M15.5 24h17" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn("text-lg font-bold tracking-tight", dark ? "text-foreground" : "text-foreground")}>
          Sphere Pharmacy
        </span>
        <span className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Lumumba Drive · Roysambu
        </span>
      </span>
    </span>
  )
}
