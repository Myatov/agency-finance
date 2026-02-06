-- Добавить колонки реквизитов в Client, если их ещё нет.
-- Выполнить один раз: npx prisma db execute --file prisma/add-client-requisites-columns.sql

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "legalEntityName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contractBasis" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "legalAddress" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "inn" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "kpp" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ogrn" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "rs" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "bik" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ks" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "paymentRequisites" TEXT;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contacts" TEXT;
