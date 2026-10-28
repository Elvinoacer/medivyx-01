-- Efficient latest-change/latest-arrival lookups for the staff live monitor.
-- No order, booking, payment or prescription data is modified.
CREATE INDEX IF NOT EXISTS "Order_updatedAt_id_idx" ON "Order"("updatedAt", "id");
CREATE INDEX IF NOT EXISTS "Order_createdAt_id_idx" ON "Order"("createdAt", "id");
CREATE INDEX IF NOT EXISTS "ServiceBooking_updatedAt_id_idx" ON "ServiceBooking"("updatedAt", "id");
CREATE INDEX IF NOT EXISTS "ServiceBooking_createdAt_id_idx" ON "ServiceBooking"("createdAt", "id");
