-- Клиент: дата старта работы с клиентом (справочное поле)
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "workStartDate" TIMESTAMP(3);

COMMENT ON COLUMN "Client"."workStartDate" IS 'Дата старта работы с клиентом, ни на что не влияет.';
