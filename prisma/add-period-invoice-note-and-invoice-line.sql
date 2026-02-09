-- Пометки «Счёт выставлен на X» без формирования счёта (ЮЛ без галочки «Формировать закрывающие документы»)
CREATE TABLE IF NOT EXISTS "PeriodInvoiceNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workPeriodId" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "legalEntityId" TEXT NOT NULL,
  "invoiceNumber" TEXT,
  "issuedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  CONSTRAINT "PeriodInvoiceNote_workPeriodId_fkey" FOREIGN KEY ("workPeriodId") REFERENCES "WorkPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PeriodInvoiceNote_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PeriodInvoiceNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PeriodInvoiceNote_workPeriodId_idx" ON "PeriodInvoiceNote"("workPeriodId");
CREATE INDEX IF NOT EXISTS "PeriodInvoiceNote_legalEntityId_idx" ON "PeriodInvoiceNote"("legalEntityId");

-- Дата счёта (для отображения и PDF)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);

-- Строки счёта (1 счёт = несколько услуг)
CREATE TABLE IF NOT EXISTS "InvoiceLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceId" TEXT NOT NULL,
  "workPeriodId" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "serviceNameOverride" TEXT,
  "siteNameOverride" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InvoiceLine_workPeriodId_fkey" FOREIGN KEY ("workPeriodId") REFERENCES "WorkPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceLine_workPeriodId_idx" ON "InvoiceLine"("workPeriodId");

-- Заполнить строки для существующих счетов (по одному периоду на счёт)
INSERT INTO "InvoiceLine" ("id", "invoiceId", "workPeriodId", "amount", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, i."id", i."workPeriodId", i."amount", 0, i."createdAt", i."updatedAt"
FROM "Invoice" i
WHERE NOT EXISTS (SELECT 1 FROM "InvoiceLine" il WHERE il."invoiceId" = i."id");
