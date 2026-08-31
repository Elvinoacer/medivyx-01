import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { otpCode } from "@/lib/hash"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const raw = String(body.phone ?? "").trim()
    const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
    if (!m) return NextResponse.json({ error: "Enter a valid Kenyan phone number (e.g. 0712 345 678)." }, { status: 400 })
    const phone = `+254${m[1]}`

    const code = otpCode()
    await db.otpCode.create({
      data: { phone, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    })
    // In production this sends via an SMS gateway (e.g. Africa's Talking).
    // Demo: return the code so the flow is testable end-to-end.
    return NextResponse.json({ demoCode: code })
  } catch {
    return NextResponse.json({ error: "Could not send the OTP. Please try again." }, { status: 500 })
  }
}
