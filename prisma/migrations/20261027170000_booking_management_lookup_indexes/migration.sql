-- Support date-ordered booking queues, status filters, and staff schedules at scale.
-- These are additive indexes; they do not alter booking data or status history.
CREATE INDEX IF NOT EXISTS "ServiceBooking_scheduledStart_id_idx"
  ON "ServiceBooking"("scheduledStart", "id");
CREATE INDEX IF NOT EXISTS "ServiceBooking_status_scheduledStart_id_idx"
  ON "ServiceBooking"("status", "scheduledStart", "id");
CREATE INDEX IF NOT EXISTS "ServiceBooking_assignedStaffId_scheduledStart_idx"
  ON "ServiceBooking"("assignedStaffId", "scheduledStart");
