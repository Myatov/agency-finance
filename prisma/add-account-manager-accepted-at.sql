-- Добавить accountManagerAcceptedAt: null = АМ назначен, но ещё не принял
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "accountManagerAcceptedAt" TIMESTAMP(3);
-- Существующие клиенты с АМ считаем принятыми
UPDATE "Client" SET "accountManagerAcceptedAt" = "updatedAt" WHERE "accountManagerId" IS NOT NULL AND "accountManagerAcceptedAt" IS NULL;
