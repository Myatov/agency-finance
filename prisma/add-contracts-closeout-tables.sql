-- Только новые таблицы для Договоров и Закрывающих документов.
-- Не трогает CostCategory и FinancialModelExpenseType — данные сохраняются.
-- Выполнить один раз: psql ... -f prisma/add-contracts-closeout-tables.sql

-- Enum'ы (если ещё нет)
DO $$ BEGIN
  CREATE TYPE "ContractDocType" AS ENUM ('CONTRACT', 'ADDENDUM', 'NDA', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CloseoutPeriodType" AS ENUM ('MONTH', 'STAGE', 'ONE_TIME');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CloseoutPackageStatus" AS ENUM ('PREPARING', 'SENT', 'SIGNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CloseoutDocType" AS ENUM ('ACT', 'INVOICE', 'SF', 'UPD', 'RECONCILIATION', 'REPORT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE "CloseoutDocStatus" AS ENUM ('DRAFT', 'SIGNED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ContractDocument
CREATE TABLE IF NOT EXISTS "ContractDocument" (
  "id" TEXT PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "siteId" TEXT,
  "type" "ContractDocType" NOT NULL DEFAULT 'CONTRACT',
  "parentId" TEXT,
  "filePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INT,
  "docNumber" TEXT,
  "docDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "comment" TEXT,
  "tags" TEXT,
  "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ContractDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContractDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContractDocument_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ContractDocument_clientId_idx" ON "ContractDocument"("clientId");
CREATE INDEX IF NOT EXISTS "ContractDocument_siteId_idx" ON "ContractDocument"("siteId");
CREATE INDEX IF NOT EXISTS "ContractDocument_uploadedById_idx" ON "ContractDocument"("uploadedById");
CREATE INDEX IF NOT EXISTS "ContractDocument_status_idx" ON "ContractDocument"("status");
CREATE INDEX IF NOT EXISTS "ContractDocument_uploadedAt_idx" ON "ContractDocument"("uploadedAt");

-- ContractSection
CREATE TABLE IF NOT EXISTS "ContractSection" (
  "id" TEXT PRIMARY KEY,
  "contractId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "comment" TEXT,
  "siteId" TEXT,
  "serviceId" TEXT,
  CONSTRAINT "ContractSection_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContractSection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ContractSection_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ContractSection_contractId_idx" ON "ContractSection"("contractId");

-- CloseoutPackage
CREATE TABLE IF NOT EXISTS "CloseoutPackage" (
  "id" TEXT PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "siteId" TEXT,
  "serviceId" TEXT,
  "period" TEXT NOT NULL,
  "periodType" "CloseoutPeriodType" NOT NULL DEFAULT 'MONTH',
  "amount" BIGINT,
  "status" "CloseoutPackageStatus" NOT NULL DEFAULT 'PREPARING',
  CONSTRAINT "CloseoutPackage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CloseoutPackage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CloseoutPackage_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CloseoutPackage_clientId_idx" ON "CloseoutPackage"("clientId");
CREATE INDEX IF NOT EXISTS "CloseoutPackage_period_idx" ON "CloseoutPackage"("period");
CREATE INDEX IF NOT EXISTS "CloseoutPackage_status_idx" ON "CloseoutPackage"("status");

-- CloseoutDocument
CREATE TABLE IF NOT EXISTS "CloseoutDocument" (
  "id" TEXT PRIMARY KEY,
  "packageId" TEXT,
  "clientId" TEXT NOT NULL,
  "period" TEXT,
  "docType" "CloseoutDocType" NOT NULL DEFAULT 'ACT',
  "filePath" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT,
  "sizeBytes" INT,
  "docDate" TIMESTAMPTZ,
  "amount" BIGINT,
  "status" "CloseoutDocStatus" NOT NULL DEFAULT 'DRAFT',
  "comment" TEXT,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CloseoutDocument_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "CloseoutPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CloseoutDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CloseoutDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "CloseoutDocument_clientId_idx" ON "CloseoutDocument"("clientId");
CREATE INDEX IF NOT EXISTS "CloseoutDocument_packageId_idx" ON "CloseoutDocument"("packageId");
CREATE INDEX IF NOT EXISTS "CloseoutDocument_period_idx" ON "CloseoutDocument"("period");
CREATE INDEX IF NOT EXISTS "CloseoutDocument_uploadedById_idx" ON "CloseoutDocument"("uploadedById");
