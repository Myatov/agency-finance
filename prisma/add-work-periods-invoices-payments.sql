-- LegalEntity: флаги закрывающих документов
ALTER TABLE "LegalEntity"
  ADD COLUMN IF NOT EXISTS "generateClosingDocs" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "closingDocPerInvoice" BOOLEAN;

-- Enums для периодов и отчётов
DO $$ BEGIN
  CREATE TYPE "WorkPeriodType" AS ENUM ('STANDARD', 'EXTENDED', 'BONUS', 'COMPENSATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE TYPE "PeriodReportPaymentType" AS ENUM ('PREPAY', 'POSTPAY', 'FRACTIONAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- WorkPeriod (FK types match existing tables: id/serviceId as TEXT if Service uses text)
CREATE TABLE IF NOT EXISTS "WorkPeriod" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "serviceId" TEXT NOT NULL REFERENCES "Service"(id) ON DELETE CASCADE,
  "dateFrom" TIMESTAMP(3) NOT NULL,
  "dateTo" TIMESTAMP(3) NOT NULL,
  "periodType" "WorkPeriodType" NOT NULL DEFAULT 'STANDARD',
  "invoiceNotRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WorkPeriod_serviceId_idx" ON "WorkPeriod"("serviceId");
CREATE INDEX IF NOT EXISTS "WorkPeriod_dateFrom_dateTo_idx" ON "WorkPeriod"("dateFrom", "dateTo");

-- WorkPeriodReport
CREATE TABLE IF NOT EXISTS "WorkPeriodReport" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workPeriodId" TEXT NOT NULL UNIQUE REFERENCES "WorkPeriod"(id) ON DELETE CASCADE,
  "filePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INT,
  "paymentType" "PeriodReportPaymentType" NOT NULL,
  "accountManagerId" TEXT NOT NULL REFERENCES "User"(id),
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WorkPeriodReport_workPeriodId_idx" ON "WorkPeriodReport"("workPeriodId");
CREATE INDEX IF NOT EXISTS "WorkPeriodReport_accountManagerId_idx" ON "WorkPeriodReport"("accountManagerId");

-- Invoice
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "workPeriodId" TEXT NOT NULL REFERENCES "WorkPeriod"(id) ON DELETE CASCADE,
  "amount" BIGINT NOT NULL,
  "coverageFrom" TIMESTAMP(3),
  "coverageTo" TIMESTAMP(3),
  "invoiceNumber" TEXT,
  "legalEntityId" TEXT NOT NULL REFERENCES "LegalEntity"(id),
  "generateClosingDocsAtInvoice" BOOLEAN NOT NULL DEFAULT false,
  "closingDocPerInvoiceAtInvoice" BOOLEAN,
  "invoiceNotRequired" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT REFERENCES "User"(id),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Invoice_workPeriodId_idx" ON "Invoice"("workPeriodId");
CREATE INDEX IF NOT EXISTS "Invoice_legalEntityId_idx" ON "Invoice"("legalEntityId");
CREATE INDEX IF NOT EXISTS "Invoice_createdByUserId_idx" ON "Invoice"("createdByUserId");

-- Payment
CREATE TABLE IF NOT EXISTS "Payment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "invoiceId" TEXT NOT NULL REFERENCES "Invoice"(id) ON DELETE CASCADE,
  "amount" BIGINT NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "comment" TEXT,
  "createdByUserId" TEXT NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_createdByUserId_idx" ON "Payment"("createdByUserId");
CREATE INDEX IF NOT EXISTS "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CloseoutDocument: связь с периодом и счётом (после создания WorkPeriod и Invoice)
ALTER TABLE "CloseoutDocument"
  ADD COLUMN IF NOT EXISTS "workPeriodId" TEXT REFERENCES "WorkPeriod"(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT REFERENCES "Invoice"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CloseoutDocument_workPeriodId_idx" ON "CloseoutDocument"("workPeriodId");
CREATE INDEX IF NOT EXISTS "CloseoutDocument_invoiceId_idx" ON "CloseoutDocument"("invoiceId");
