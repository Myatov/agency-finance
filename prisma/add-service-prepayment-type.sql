-- Service: тип предоплаты (для логики просрочки выставления счёта)
DO $$ BEGIN
  CREATE TYPE "PrepaymentType" AS ENUM ('FULL_PREPAY', 'PARTIAL_PREPAY', 'POSTPAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "prepaymentType" "PrepaymentType" NOT NULL DEFAULT 'POSTPAY';
