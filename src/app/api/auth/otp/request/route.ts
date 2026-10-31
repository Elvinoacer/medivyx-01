import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { hashOtp, otpCode } from "@/lib/hash"
import { enforceRateLimit, rejectOversizedRequest } from "@/lib/security/request"
import { sendSms } from "@/lib/sms"

const PHONE_RE = /^(?:\+?254|0)?(7\d{8}|1\d{8})$/

export async function POST(request: Request) {
  try {
    const tooLarge = rejectOversizedRequest(request, 4_096)
    if (tooLarge) return tooLarge
    const body = await request.json()
    const raw = String(body.phone ?? "").trim()
    const m = PHONE_RE.exec(raw.replace(/\s+/g, ""))
    if (!m) return NextResponse.json({ error: "Enter a valid Kenyan phone number (e.g. 0712 345 678)." }, { status: 400 })
    const phone = `+254${m[1]}`
    const limited = await enforceRateLimit(request, "otp-request", 3, 10 * 60 * 1000, phone)
    if (limited) return limited

    const code = otpCode()
    await db.otpCode.updateMany({ where: { phone, used: false }, data: { used: true } })
    await db.otpCode.create({
      data: { phone, codeHash: hashOtp(phone, code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    })
    await sendSms(phone, `Your Medivyx verification code is ${code}. It expires in 5 minutes. Do not share it.`)
    return NextResponse.json({ sent: true }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Could not send the OTP. Please try again." }, { status: 500 })
  }
}
