// Resend Email Integration for Medivyx
// Uses Resend REST API v1 directly with native fetch for maximum speed, resilience, and portability.

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  idempotencyKey?: string
}

export interface EmailResult {
  success: boolean
  id?: string
  simulated?: boolean
  error?: string
}

const RESEND_ENDPOINT = "https://api.resend.com/emails"

export async function sendEmail(opts: SendEmailOptions): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const defaultFrom =
    process.env.RESEND_FROM_EMAIL?.trim() || "Medivyx <onboarding@resend.dev>"

  const toList = Array.isArray(opts.to) ? opts.to : [opts.to]
  // Filter empty or invalid emails
  const validRecipients = toList
    .map((e) => e.trim())
    .filter((e) => e.length > 3 && e.includes("@"))

  if (validRecipients.length === 0) {
    return { success: false, error: "No valid recipients specified" }
  }

  if (!apiKey) {
    return { success: false, error: "Email delivery is not configured" }
  }

  if (process.env.NODE_ENV === "production" && (!process.env.RESEND_FROM_EMAIL || defaultFrom.includes("@resend.dev"))) {
    return { success: false, error: "A verified sender domain is required in production" }
  }
  try {
    const payload: Record<string, unknown> = {
      from: opts.from || defaultFrom,
      to: validRecipients,
      subject: opts.subject,
      html: opts.html,
    }
    if (opts.text) payload.text = opts.text
    if (opts.replyTo) payload.reply_to = opts.replyTo

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      const errMsg = data?.message || data?.error || `HTTP ${response.status}`
      console.warn(JSON.stringify({ level: "warn", event: "email_delivery_failed", status: response.status }))
      return { success: false, error: errMsg }
    }

    if (!data?.id) return { success: false, error: "Email provider response was incomplete" }
    return { success: true, id: data.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ level: "error", event: "email_delivery_exception" }))
    return { success: false, error: message }
  }
}
