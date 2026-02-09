-- WorkPeriod: ожидаемая сумма за период (история цен по периодам)
ALTER TABLE "WorkPeriod"
  ADD COLUMN IF NOT EXISTS "expectedAmount" BIGINT;

COMMENT ON COLUMN "WorkPeriod"."expectedAmount" IS 'Ожидаемая сумма за этот период в копейках. Если NULL — используется цена услуги (Service.price).';
