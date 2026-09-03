"use client"

import { cn } from "@/lib/utils"

export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <img
      src="/images/sphere_pharmacy_logo-removebg-preview.png"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0 object-contain", className)}
    />
  )
}

export function LogoFull({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("flex items-center", className)}>
      <img
        src={dark ? "/images/sphere_pharmacy_logo_light.webp" : "/images/sphere_pharmacy_logo-removebg-preview.png"}
        alt="Sphere Pharmacy"
        width={220}
        height={64}
        className="h-auto max-h-12 w-auto max-w-full object-contain"
      />
    </span>
  )
}
