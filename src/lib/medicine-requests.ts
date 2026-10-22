import { z } from "zod"
import { normalizePaymentPhone } from "@/lib/security/payment"

export const MEDICINE_REQUEST_STATUSES = ["NEW", "CONTACTED", "FULFILLED", "UNAVAILABLE"] as const
export type MedicineRequestStatus = typeof MEDICINE_REQUEST_STATUSES[number]
export const MEDICINE_REQUEST_LABELS: Record<MedicineRequestStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  FULFILLED: "Fulfilled",
  UNAVAILABLE: "Unavailable",
}

export const MEDICINE_PHOTO_MAX_BYTES = 3 * 1024 * 1024
export const MEDICINE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

export const medicineRequestSchema = z.object({
  medicineName: z.string().trim().min(2, "Enter the medicine name.").max(200, "Keep the medicine name under 200 characters."),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]+$/, "Enter a valid Kenyan phone number.")
    .transform((value, context) => {
      const phone = normalizePaymentPhone(value)
      if (!phone) {
        context.addIssue({ code: "custom", message: "Enter a valid Kenyan phone number, e.g. 0712 345 678." })
        return z.NEVER
      }
      return phone
    }),
  photo: z.object({
    name: z.string().trim().min(1).max(120),
    type: z.enum(MEDICINE_PHOTO_TYPES),
    data: z.string().min(4).max(Math.ceil(MEDICINE_PHOTO_MAX_BYTES / 3) * 4)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The photo is invalid. Please choose it again.")
      .refine((value) => value.length % 4 === 0, "The photo is invalid. Please choose it again."),
  }).optional(),
})

export const medicineRequestUpdateSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.enum(MEDICINE_REQUEST_STATUSES),
  staffNotes: z.string().trim().max(1000, "Keep notes under 1,000 characters."),
})

export type MedicineRequestInput = z.input<typeof medicineRequestSchema>

export interface MedicineRequestDTO {
  id: string
  medicineName: string
  phone: string
  status: MedicineRequestStatus
  staffNotes: string | null
  photoUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface MedicineRequestsResponse {
  items: MedicineRequestDTO[]
  total: number
  page: number
  pageSize: number
}
