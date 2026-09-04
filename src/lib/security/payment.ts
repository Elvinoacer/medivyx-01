export function money(value: unknown): number {
  const amount = Number(value)
  if (!Number.isFinite(amount)) throw new Error("Invalid monetary amount")
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

export function sameMoney(left: unknown, right: unknown): boolean {
  return Math.round(money(left) * 100) === Math.round(money(right) * 100)
}

export function normalizePaymentPhone(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "")
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`
  if (/^[17]\d{8}$/.test(digits)) return `+254${digits}`
  return null
}

export function paymentMatchesExpected(input: { expectedAmount: unknown; actualAmount: unknown; expectedCurrency?: string | null; actualCurrency?: string | null; expectedPhone?: string | null; actualPhone?: string | null; receipt?: string | null }): boolean {
  if (!sameMoney(input.expectedAmount, input.actualAmount)) return false
  if ((input.expectedCurrency || "KES").toUpperCase() !== (input.actualCurrency || "KES").toUpperCase()) return false
  if (input.expectedPhone && normalizePaymentPhone(input.expectedPhone) !== normalizePaymentPhone(input.actualPhone)) return false
  return Boolean(input.receipt && /^[A-Z0-9-]{6,64}$/i.test(input.receipt))
}
