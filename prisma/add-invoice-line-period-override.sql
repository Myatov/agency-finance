-- Период в строке счёта (редактируемый текст, иначе из workPeriod)
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "periodOverride" TEXT;
