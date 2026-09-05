CREATE TABLE "NotificationDelivery" (
 "id" TEXT NOT NULL PRIMARY KEY, "dedupeKey" TEXT NOT NULL,
 "userId" TEXT, "staffId" TEXT, "channel" TEXT NOT NULL, "payload" JSONB NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
 "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lockedUntil" TIMESTAMP(3), "lockToken" TEXT, "providerId" TEXT, "lastError" TEXT,
 "sentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "NotificationDelivery_dedupeKey_key" ON "NotificationDelivery"("dedupeKey");
CREATE INDEX "NotificationDelivery_status_availableAt_idx" ON "NotificationDelivery"("status", "availableAt");
CREATE TABLE "EmailSuppression" (
 "email" TEXT NOT NULL PRIMARY KEY, "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EmailDeliveryEvent" (
 "id" TEXT NOT NULL PRIMARY KEY, "providerId" TEXT NOT NULL, "status" TEXT NOT NULL,
 "processed" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "EmailDeliveryEvent_processed_createdAt_idx" ON "EmailDeliveryEvent"("processed", "createdAt");
