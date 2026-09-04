-- Sphere Pharmacy security and integrity hardening.
-- Existing OTPs and sessions are intentionally invalidated where required.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
ALTER TABLE "StaffUser" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "authVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "codeHash" TEXT;
ALTER TABLE "OtpCode" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
UPDATE "OtpCode" SET "codeHash" = encode(sha256(("id" || clock_timestamp()::text)::bytea), 'hex') WHERE "codeHash" IS NULL;
ALTER TABLE "OtpCode" ALTER COLUMN "codeHash" SET NOT NULL;
ALTER TABLE "OtpCode" DROP COLUMN IF EXISTS "code";

ALTER TABLE "Product" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2);
ALTER TABLE "Product" ALTER COLUMN "compareAtPrice" TYPE DECIMAL(12,2) USING ROUND("compareAtPrice"::numeric, 2);
ALTER TABLE "Order" ALTER COLUMN "deliveryFee" TYPE DECIMAL(12,2) USING ROUND("deliveryFee"::numeric, 2);
ALTER TABLE "Order" ALTER COLUMN "subtotal" TYPE DECIMAL(12,2) USING ROUND("subtotal"::numeric, 2);
ALTER TABLE "Order" ALTER COLUMN "discountAmount" TYPE DECIMAL(12,2) USING ROUND("discountAmount"::numeric, 2);
ALTER TABLE "Order" ALTER COLUMN "total" TYPE DECIMAL(12,2) USING ROUND("total"::numeric, 2);
ALTER TABLE "OrderItem" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2);
ALTER TABLE "OrderItem" ALTER COLUMN "lineTotal" TYPE DECIMAL(12,2) USING ROUND("lineTotal"::numeric, 2);
ALTER TABLE "Payment" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "Service" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2);
ALTER TABLE "ServiceBooking" ALTER COLUMN "price" TYPE DECIMAL(12,2) USING ROUND("price"::numeric, 2);
ALTER TABLE "ServicePayment" ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestEmail" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestAccessTokenHash" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "guestAccessExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "inventoryReservedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "inventoryReleasedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "refundReference" TEXT;
ALTER TABLE "ServicePayment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'KES';
ALTER TABLE "ServicePayment" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "ServicePayment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "maxUses" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "perUserLimit" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "minimumSpend" DECIMAL(12,2);

-- Normalize identifiers before adding uniqueness. Duplicates are deliberately invalidated.
UPDATE "Promotion" SET "code" = upper(trim("code")) WHERE "code" IS NOT NULL;
WITH d AS (SELECT "id", row_number() OVER (PARTITION BY "code" ORDER BY "createdAt", "id") n FROM "Promotion" WHERE "code" IS NOT NULL)
UPDATE "Promotion" p SET "code" = NULL FROM d WHERE p."id" = d."id" AND d.n > 1;
WITH d AS (SELECT "id", row_number() OVER (PARTITION BY "pickupCode" ORDER BY "createdAt", "id") n FROM "Order" WHERE "pickupCode" IS NOT NULL)
UPDATE "Order" o SET "pickupCode" = NULL FROM d WHERE o."id" = d."id" AND d.n > 1;
WITH d AS (SELECT "id", row_number() OVER (PARTITION BY "provider", "providerReference" ORDER BY "createdAt", "id") n FROM "Payment" WHERE "providerReference" IS NOT NULL)
UPDATE "Payment" p SET "providerReference" = NULL FROM d WHERE p."id" = d."id" AND d.n > 1;
WITH d AS (SELECT "id", row_number() OVER (PARTITION BY "provider", "checkoutRequestId" ORDER BY "createdAt", "id") n FROM "Payment" WHERE "checkoutRequestId" IS NOT NULL)
UPDATE "Payment" p SET "checkoutRequestId" = NULL FROM d WHERE p."id" = d."id" AND d.n > 1;
WITH d AS (SELECT "id", row_number() OVER (PARTITION BY "provider", "providerReference" ORDER BY "createdAt", "id") n FROM "ServicePayment" WHERE "providerReference" IS NOT NULL)
UPDATE "ServicePayment" p SET "providerReference" = NULL FROM d WHERE p."id" = d."id" AND d.n > 1;
WITH d AS (SELECT "id", row_number() OVER (PARTITION BY "provider", "checkoutRequestId" ORDER BY "createdAt", "id") n FROM "ServicePayment" WHERE "checkoutRequestId" IS NOT NULL)
UPDATE "ServicePayment" p SET "checkoutRequestId" = NULL FROM d WHERE p."id" = d."id" AND d.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_pickupCode_key" ON "Order"("pickupCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_guestAccessTokenHash_key" ON "Order"("guestAccessTokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_code_key" ON "Promotion"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_eventId_key" ON "Payment"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_refundReference_key" ON "Payment"("refundReference");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_providerReference_key" ON "Payment"("provider", "providerReference");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_provider_checkoutRequestId_key" ON "Payment"("provider", "checkoutRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "ServicePayment_eventId_key" ON "ServicePayment"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "ServicePayment_idempotencyKey_key" ON "ServicePayment"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ServicePayment_provider_providerReference_key" ON "ServicePayment"("provider", "providerReference");
CREATE UNIQUE INDEX IF NOT EXISTS "ServicePayment_provider_checkoutRequestId_key" ON "ServicePayment"("provider", "checkoutRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "Address_one_default_per_user" ON "Address"("userId") WHERE "isDefault" = true;
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceAvailability_interval_key" ON "ServiceAvailability"("serviceId", "dayOfWeek", "startTime", "endTime");

CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Session_staffId_expiresAt_idx" ON "Session"("staffId", "expiresAt");
CREATE INDEX IF NOT EXISTS "OtpCode_phone_used_expiresAt_createdAt_idx" ON "OtpCode"("phone", "used", "expiresAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_riderId_status_createdAt_idx" ON "Order"("riderId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_guestPhone_createdAt_idx" ON "Order"("guestPhone", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "Prescription_userId_createdAt_idx" ON "Prescription"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Prescription_orderId_status_idx" ON "Prescription"("orderId", "status");
CREATE INDEX IF NOT EXISTS "Prescription_status_createdAt_idx" ON "Prescription"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_orderId_status_createdAt_idx" ON "Payment"("orderId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Review_productId_status_createdAt_idx" ON "Review"("productId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entity_entityId_createdAt_idx" ON "AuditLog"("entity", "entityId", "createdAt");

CREATE TABLE IF NOT EXISTS "PrescriptionAccessLog" (
  "id" TEXT PRIMARY KEY,
  "prescriptionId" TEXT NOT NULL REFERENCES "Prescription"("id") ON DELETE CASCADE,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PrescriptionAccessLog_prescriptionId_createdAt_idx" ON "PrescriptionAccessLog"("prescriptionId", "createdAt");

CREATE TABLE IF NOT EXISTS "PromotionRedemption" (
  "id" TEXT PRIMARY KEY,
  "promotionId" TEXT NOT NULL REFERENCES "Promotion"("id") ON DELETE CASCADE,
  "orderId" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PromotionRedemption_orderId_key" ON "PromotionRedemption"("orderId");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_createdAt_idx" ON "PromotionRedemption"("promotionId", "createdAt");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_userId_idx" ON "PromotionRedemption"("promotionId", "userId");

CREATE TABLE IF NOT EXISTS "LoyaltyLedger" (
  "id" TEXT PRIMARY KEY,
  "eventKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyLedger_eventKey_key" ON "LoyaltyLedger"("eventKey");
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_userId_createdAt_idx" ON "LoyaltyLedger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoyaltyLedger_orderId_createdAt_idx" ON "LoyaltyLedger"("orderId", "createdAt");

CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
  "key" TEXT PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowEnds" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RateLimitBucket_windowEnds_idx" ON "RateLimitBucket"("windowEnds");

CREATE TABLE IF NOT EXISTS "ScheduledJobDelivery" (
  "key" TEXT PRIMARY KEY,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "paymentId" TEXT REFERENCES "Payment"("id") ON DELETE CASCADE,
  "servicePaymentId" TEXT REFERENCES "ServicePayment"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_paymentId_createdAt_idx" ON "PaymentWebhookEvent"("paymentId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_servicePaymentId_createdAt_idx" ON "PaymentWebhookEvent"("servicePaymentId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ServiceBooking" ADD CONSTRAINT "ServiceBooking_no_overlap"
    EXCLUDE USING gist (
      "serviceId" WITH =,
      tstzrange("scheduledStart", "scheduledEnd", '[)') WITH &&
    ) WHERE ("status" IN ('PENDING', 'CONFIRMED', 'PAID'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Staff role/password changes and this release invalidate pre-hardening staff sessions.
DELETE FROM "Session" WHERE "staffId" IS NOT NULL;
