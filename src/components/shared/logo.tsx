"use client"

import { cn } from "@/lib/utils"

export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl", className)} style={{ width: size, height: size }}>
      <svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="medivyx-mark-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#059669" />
            <stop offset="100%" stop-color="#0f766e" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="14" fill="url(#medivyx-mark-grad)" />
        <rect x="0.5" y="0.5" width="47" height="47" rx="13.5" stroke="rgba(255,255,255,0.25)" stroke-width="1" />
        <rect x="20.5" y="11" width="7" height="26" rx="3.5" fill="#ffffff" />
        <rect x="11" y="20.5" width="26" height="7" rx="3.5" fill="#ffffff" />
        <circle cx="24" cy="24" r="4" fill="#0f766e" />
        <circle cx="24" cy="24" r="1.8" fill="#34d399" />
      </svg>
    </span>
  )
}

export function LogoFull({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <img
      src={dark ? "/images/medivyx_logo_dark.svg" : "/images/medivyx_logo.svg"}
      alt="Medivyx"
      width={220}
      height={60}
      className={cn("h-auto max-h-12 w-auto max-w-full object-contain", className)}
    />
  )
}
