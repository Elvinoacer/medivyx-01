-- Persist the checkout payment choice so unpaid delivery orders can be
-- distinguished from prepaid payments without inferring it from their status.
-- Existing orders stay NULL (unknown intent) and cannot be auto-enabled for COD.
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;
