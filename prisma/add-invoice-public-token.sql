-- Добавление публичного токена для счёта (QR и скачивание PDF без авторизации)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "publicToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_publicToken_key" ON "Invoice"("publicToken") WHERE "publicToken" IS NOT NULL;
-- Проставить токены существующим счетам
UPDATE "Invoice" SET "publicToken" = gen_random_uuid()::text WHERE "publicToken" IS NULL;
