CREATE TABLE "MedicineRequest" (
    "id" TEXT NOT NULL,
    "medicineName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "staffNotes" TEXT,
    "photoName" TEXT,
    "photoType" TEXT,
    "storageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MedicineRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MedicineRequest_status_check" CHECK ("status" IN ('NEW', 'CONTACTED', 'FULFILLED', 'UNAVAILABLE'))
);

CREATE INDEX "MedicineRequest_status_createdAt_idx" ON "MedicineRequest"("status", "createdAt");
