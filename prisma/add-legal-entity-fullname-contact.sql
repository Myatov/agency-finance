-- Юрлицо: полное название и контактные данные (необязательные)
ALTER TABLE "LegalEntity" ADD COLUMN IF NOT EXISTS "fullName" TEXT;
ALTER TABLE "LegalEntity" ADD COLUMN IF NOT EXISTS "contactInfo" TEXT;
