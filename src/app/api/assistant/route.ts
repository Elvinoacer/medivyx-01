import { NextResponse } from "next/server"
import ZAI from "z-ai-web-dev-sdk"

interface IncomingMessage {
  role: "user" | "assistant"
  content: string
  escalated?: boolean
}

// FR-1.8: general pharmacy questions only — medication/dosage questions MUST escalate to staff.
const MEDICATION_KEYWORDS = [
  "dosage", "dose", "how much should i take", "how many should i take", "mg", "ml of",
  "side effect", "side-effect", "interaction", "contraindicat", "overdose",
  "pregnant", "breastfeed", "breast-feeding", "infant dose", "child dose", "baby dose",
  "antibiotic for", "is it safe to take", "can i take", "can i mix", "with alcohol",
  "allergic to", "penicillin allergy", "substitute for", "alternative to",
  "amoxicillin", "azithromycin", "metronidazole", "metformin", "amlodipine", "ibuprofen",
  "paracetamol", "diclofenac", "omeprazole", "salbutamol", "ventolin", "hydrocortisone",
  "clotrimazole", "loratadine", "cetirizine", "desloratadine", "hyoscine", "loperamide",
  "blood pressure medicine", "diabetes medicine", "insulin", "malaria treatment",
  "typhoid", "uti treatment", "infection treat", "std treatment", "contraceptive pill",
]

const SYSTEM_PROMPT = `You are the Sphere Pharmacy assistant — a friendly helper for GENERAL pharmacy questions only.
You represent Sphere Pharmacy, a retail community pharmacy on Lumumba Drive, Roysambu, Nairobi, Kenya.

Facts you may share:
- Opening hours: daily 8:00 AM – 10:30 PM (holiday hours may vary).
- Location: Lumumba Drive, Roysambu, Nairobi. Directions link is on the website.
- Phone: +254 707 475 208. WhatsApp ordering is available via the website.
- Ordering: browse the catalogue, add to cart; prescription-only items require uploading a prescription image/PDF which a pharmacist reviews (usually within 2 working hours) before dispensing. Availability is confirmed, then you pay via M-Pesa, card, or cash on pickup/delivery.
- Fulfilment: in-store pickup (free, usually ready same day) or delivery with zone-based fees (e.g. Roysambu/TRM KSh 150, Kasarani KSh 200, Githurai 44 KSh 250, Ruaraka/Baba Dogo KSh 250, CBD KSh 400, other Nairobi areas KSh 500). Free delivery on orders over KSh 3,000 (within covered zones).
- Payments: M-Pesa (STK push), card via IntaSend, pay-on-pickup, and reservations (hold in store, pay at counter).
- Order tracking: order status page shows every step (received → review → availability confirmed → awaiting payment → paid → preparing → ready/out for delivery → completed).
- Prescriptions: upload image or PDF, pharmacist verifies, refills possible where allowed.

HARD RULES:
- NEVER give medication advice, dosages, drug interactions, or diagnoses. If a question is even slightly medical, tell the customer you'll connect them with the pharmacy team and they can WhatsApp +254 707 475 208 or call.
- NEVER invent licence numbers, prices of specific medicines, or stock claims.
- Keep answers short (2-4 sentences), warm, and clear. Use Kenyan English. A little Swahili warmth ("Karibu!") is fine at greetings.`

function isMedicationQuestion(text: string): boolean {
  const lower = text.toLowerCase()
  return MEDICATION_KEYWORDS.some((k) => lower.includes(k))
}

const ESCALATION_REPLY = `That's a medication-specific question, and I want you to get a safe answer from a real pharmacist rather than a bot. Please WhatsApp or call us on +254 707 475 208 — our pharmacy team will advise you directly. If it's about a prescription order, they can also check it for you.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const messages: IncomingMessage[] = Array.isArray(body.messages) ? body.messages : []
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUser || !lastUser.content?.trim()) {
      return NextResponse.json({ reply: "Karibu! How can I help — hours, delivery, ordering or prescriptions?", escalated: false })
    }

    // Guardrail: medication/dosage questions escalate to staff, never answered by AI (FR-1.8)
    if (isMedicationQuestion(lastUser.content)) {
      return NextResponse.json({ reply: ESCALATION_REPLY, escalated: true })
    }

    // Build a trimmed conversation for context
    const trimmed = messages.slice(-10).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }))

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        ...trimmed,
      ],
      thinking: { type: "disabled" },
    })
    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) {
      return NextResponse.json({ reply: "Sorry, I didn't catch that. Please try again — or WhatsApp us on +254 707 475 208.", escalated: false })
    }
    // double safety: if the model still leaked medical advice, escalate
    if (/\b(dosage|mg\b|take \d+ (tablet|pill|capsule)|contraindicated)\b/i.test(reply) && /\b(take|dose)\b/i.test(lastUser.content)) {
      return NextResponse.json({ reply: ESCALATION_REPLY, escalated: true })
    }
    return NextResponse.json({ reply, escalated: false })
  } catch {
    return NextResponse.json(
      { reply: "I'm having trouble right now — please WhatsApp or call us on +254 707 475 208 and we'll help you directly.", escalated: true },
      { status: 200 }
    )
  }
}
