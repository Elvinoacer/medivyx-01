"use client"

// Shared real-photo renderer for products, cart lines and category tiles.
// Falls back to the generic medicine photo when the stored value is empty,
// an emoji (legacy data) or a broken URL — so a photo is always shown.

import { useState } from "react"
import { cn } from "@/lib/utils"
import { productImageSrc, FALLBACK_PRODUCT_IMAGE } from "@/lib/image"

interface ProductImageProps {
  /** raw stored value (path, URL, emoji legacy or empty) */
  src?: string | null
  /** meaningful alt text (usually the product name) */
  alt: string
  /** wrapper classes (tile size/shape) */
  className?: string
  /** <img> classes (object-fit etc.) */
  imgClassName?: string
  fallback?: string
}

export function ProductImage({ src, alt, className, imgClassName, fallback }: ProductImageProps) {
  const [failed, setFailed] = useState(false)
  const url = productImageSrc(src, fallback)
  return (
    <span className={cn("relative flex items-center justify-center overflow-hidden", className)}>
      <img
        src={failed ? FALLBACK_PRODUCT_IMAGE : url}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("h-full w-full object-cover", imgClassName)}
      />
    </span>
  )
}
