-- Existing promotions remain public. Private codes still redeem when supplied.
ALTER TABLE "Promotion" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
