import type { MedicineRequest } from "@prisma/client"
import type { MedicineRequestDTO, MedicineRequestStatus } from "@/lib/medicine-requests"

export function toMedicineRequestDTO(row: MedicineRequest): MedicineRequestDTO {
  return {
    id: row.id,
    medicineName: row.medicineName,
    phone: row.phone,
    status: row.status as MedicineRequestStatus,
    staffNotes: row.staffNotes,
    photoUrl: row.storageKey ? `/api/admin/medicine-requests/${row.id}/photo` : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
