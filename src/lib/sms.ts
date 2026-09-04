interface SmsResult { id?: string; status: string }

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const username = process.env.AFRICAS_TALKING_USERNAME
  const apiKey = process.env.AFRICAS_TALKING_API_KEY
  const production = process.env.NODE_ENV === "production"
  if (!username || !apiKey) {
    if (production) throw new Error("SMS delivery is not configured")
    if (process.env.NODE_ENV !== "test") throw new Error("Configure AFRICAS_TALKING_USERNAME and AFRICAS_TALKING_API_KEY")
    return { status: "test-only" }
  }
  const endpoint = username === "sandbox" ? "https://api.sandbox.africastalking.com/version1/messaging" : "https://api.africastalking.com/version1/messaging"
  const body = new URLSearchParams({ username, to, message: message.slice(0, 480) })
  if (process.env.AFRICAS_TALKING_SENDER_ID) body.set("from", process.env.AFRICAS_TALKING_SENDER_ID)
  const response = await fetch(endpoint, { method: "POST", headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body })
  if (!response.ok) throw new Error(`SMS provider rejected the request (${response.status})`)
  const data = await response.json() as { SMSMessageData?: { Recipients?: Array<{ status?: string; messageId?: string }> } }
  const recipient = data.SMSMessageData?.Recipients?.[0]
  if (!recipient || !["Success", "Sent"].includes(recipient.status ?? "")) throw new Error("SMS provider did not accept the message")
  return { id: recipient.messageId, status: recipient.status ?? "Sent" }
}
