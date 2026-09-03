"use client"

import { cn } from "@/lib/utils"

export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", className)} style={{ width: size, height: size }}>
      <span className="h-full w-full rounded-full bg-primary p-1.5">
        <svg width="100%" height="100%" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="3" className="text-primary-foreground" />
          <circle cx="24" cy="24" r="14.5" stroke="currentColor" strokeWidth="1.5" opacity="0.4" className="text-primary-foreground" />
          <path d="M24 15.5v17M15.5 24h17" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" className="text-primary-foreground" />
        </svg>
      </span>
    </span>
  )
}

export function LogoFull({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <img
      src={dark ? "/images/sphere_pharmacy_logo_light.webp" : "/images/sphere_pharmacy_logo-removebg-preview.png"}
      alt="Sphere Pharmacy"
      width={220}
      height={64}
      className={cn("h-auto max-h-12 w-auto max-w-full object-contain", className)}
    />
  )
}
