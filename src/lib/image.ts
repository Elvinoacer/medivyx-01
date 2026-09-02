// Shared image-path helpers — safe for both server routes and client components.
// Products created before the real-photo migration (or imported via CSV) may still
// carry emoji glyph values in their `image` field; those fall back to the generic
// medicine photo so the storefront never renders a bare emoji again.

export const FALLBACK_PRODUCT_IMAGE = "/images/products/generic-medicine.webp"

/** True when a stored value looks like a real image (site path or http(s) URL). */
export function isImagePath(v?: string | null): boolean {
  const s = v?.trim()
  if (!s) return false
  return s.startsWith("/") || /^https?:\/\//i.test(s)
}

/** Resolve a stored image value to a usable src, with fallback. */
export function productImageSrc(v?: string | null, fallback: string = FALLBACK_PRODUCT_IMAGE): string {
  const s = v?.trim()
  return isImagePath(s) ? s! : fallback
}

/** Sanitise user-supplied image input (admin forms / CSV import): emojis → fallback. */
export function sanitizeImageInput(v?: string | null): string {
  return productImageSrc(v)
}
