// A short-lived, non-sensitive offer intent that survives browsing before checkout.
const KEY = "sphere_checkout_offer";
const CODE = /^[A-Z0-9_-]{3,32}$/;

export function rememberOffer(code: string): void {
  if (typeof window === "undefined") return;
  const normalized = code.trim().toUpperCase();
  if (!CODE.test(normalized)) return;
  try { window.sessionStorage.setItem(KEY, normalized); } catch { /* blocked storage */ }
}

export function pendingOffer(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const code = window.sessionStorage.getItem(KEY);
    return code && CODE.test(code) ? code : null;
  } catch { return null; }
}

export function forgetOffer(): void {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(KEY); } catch { /* blocked storage */ }
}
