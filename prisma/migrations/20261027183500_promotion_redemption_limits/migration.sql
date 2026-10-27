-- Record pseudonymous (HMAC) redemption scope and configurable usage ceilings.
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "perIpLimit" INTEGER;
ALTER TABLE "Promotion" ADD COLUMN IF NOT EXISTS "perBrowserLimit" INTEGER;
ALTER TABLE "PromotionRedemption" ADD COLUMN IF NOT EXISTS "ipHash" TEXT;
ALTER TABLE "PromotionRedemption" ADD COLUMN IF NOT EXISTS "browserHash" TEXT;
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_ipHash_idx" ON "PromotionRedemption"("promotionId","ipHash");
CREATE INDEX IF NOT EXISTS "PromotionRedemption_promotionId_browserHash_idx" ON "PromotionRedemption"("promotionId","browserHash");
