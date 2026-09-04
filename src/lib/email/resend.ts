// Resend Email Integration for Sphere Pharmacy
// Uses Resend REST API v1 directly with native fetch for maximum speed, resilience, and portability.

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
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
    process.env.RESEND_FROM_EMAIL?.trim() || "Sphere Pharmacy <onboarding@resend.dev>"

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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      const errMsg = data?.message || data?.error || `HTTP ${response.status}`
      console.warn(JSON.stringify({ level: "warn", event: "email_delivery_failed", status: response.status }))
      return { success: false, error: errMsg }
    }

    return { success: true, id: data?.id }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(JSON.stringify({ level: "error", event: "email_delivery_exception" }))
    return { success: false, error: message }
  }
}
