export function managedImage(value: unknown): string | null {
  if (value == null || value === "") return null
  const image = String(value).trim()
  if (image.startsWith("/images/") && !image.includes("..") && image.length <= 500) return image
  const publicBase = process.env.R2_PUBLIC_URL
  if (!publicBase) return null
  try {
    const url = new URL(image)
    const allowed = new URL(publicBase)
    return url.protocol === "https:" && url.host === allowed.host && url.pathname.startsWith(allowed.pathname) && image.length <= 1000 ? image : null
  } catch { return null }
}

export function validateServiceFields(body: Record<string, unknown>, partial = false): { error?: string; data: Record<string, unknown> } {
  const data: Record<string, unknown> = {}
  const text = (key: string, max: number, nullable = true) => {
    if (!(key in body)) return
    const value = String(body[key] ?? "").trim()
    if (value.length > max) throw new Error(`${key} is too long.`)
    data[key] = value || (nullable ? null : "")
  }
  try {
    text("name", 120, false); text("slug", 80); text("shortDescription", 240); text("description", 5_000); text("category", 80); text("priceLabel", 80)
    if (!partial && String(data.name || "").length < 2 || data.name !== undefined && String(data.name).length < 2) return { error: "Service name must be at least two characters.", data: {} }
    if ("durationMinutes" in body) {
      const value = Number(body.durationMinutes)
      if (!Number.isInteger(value) || value < 5 || value > 480) return { error: "Duration must be 5–480 whole minutes.", data: {} }
      data.durationMinutes = value
    } else if (!partial) data.durationMinutes = 15
    if ("price" in body) {
      const value = body.price == null || body.price === "" ? null : Number(body.price)
      if (value != null && (!Number.isFinite(value) || value < 0 || value > 10_000_000)) return { error: "Price is invalid.", data: {} }
      data.price = value
    }
    for (const key of ["featured", "active"] as const) if (key in body) {
      if (typeof body[key] !== "boolean") return { error: `${key} must be true or false.`, data: {} }
      data[key] = body[key]
    }
    if ("sortOrder" in body) {
      const value = Number(body.sortOrder)
      if (!Number.isSafeInteger(value) || value < -10_000 || value > 10_000) return { error: "Sort order is invalid.", data: {} }
      data.sortOrder = value
    }
    if ("heroImage" in body) {
      const value = managedImage(body.heroImage)
      if (body.heroImage && !value) return { error: "Hero image must be an owned upload or site image.", data: {} }
      data.heroImage = value
    }
    return { data }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Service data is invalid.", data: {} }
  }
}
