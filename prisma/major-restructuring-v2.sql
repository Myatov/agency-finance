-- =========================================================
-- Major restructuring v2: data migration and fixes
-- =========================================================

-- 1. Fix CostCategory primary key constraint name (if needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CostCategoryNew_pkey'
  ) THEN
    ALTER TABLE "CostCategory" RENAME CONSTRAINT "CostCategoryNew_pkey" TO "CostCategory_pkey";
    RAISE NOTICE 'Fixed CostCategory PK constraint name';
  END IF;
END $$;

-- 2. Fix Invoice publicToken unique index (drop partial, create full)
DO $$
BEGIN
  -- Check if the index exists and is partial (has a WHERE clause)
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'Invoice_publicToken_key' 
    AND indexdef LIKE '%WHERE%'
  ) THEN
    DROP INDEX "Invoice_publicToken_key";
    CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");
    RAISE NOTICE 'Fixed Invoice_publicToken_key index';
  END IF;
END $$;

-- 3. Clean up orphaned WorkPeriod records (pointing to deleted services)
DELETE FROM "PeriodInvoiceNote" WHERE "workPeriodId" IN (
  SELECT wp.id FROM "WorkPeriod" wp LEFT JOIN "Service" s ON wp."serviceId" = s.id WHERE s.id IS NULL
);
DELETE FROM "InvoiceLine" WHERE "workPeriodId" IN (
  SELECT wp.id FROM "WorkPeriod" wp LEFT JOIN "Service" s ON wp."serviceId" = s.id WHERE s.id IS NULL
);
DELETE FROM "Income" WHERE "workPeriodId" IN (
  SELECT wp.id FROM "WorkPeriod" wp LEFT JOIN "Service" s ON wp."serviceId" = s.id WHERE s.id IS NULL
);
DELETE FROM "WorkPeriodReport" WHERE "workPeriodId" IN (
  SELECT wp.id FROM "WorkPeriod" wp LEFT JOIN "Service" s ON wp."serviceId" = s.id WHERE s.id IS NULL
);
DELETE FROM "CloseoutDocument" WHERE "workPeriodId" IN (
  SELECT wp.id FROM "WorkPeriod" wp LEFT JOIN "Service" s ON wp."serviceId" = s.id WHERE s.id IS NULL
);
DELETE FROM "Invoice" WHERE "workPeriodId" IN (
  SELECT wp.id FROM "WorkPeriod" wp LEFT JOIN "Service" s ON wp."serviceId" = s.id WHERE s.id IS NULL
);
DELETE FROM "WorkPeriod" WHERE "serviceId" NOT IN (SELECT id FROM "Service");

-- 4. Migrate accountManagerId from Site to Client
-- For each site with an accountManagerId, set the corresponding client's accountManagerId
-- Takes the most recently updated site's AM for each client
DO $$
BEGIN
  -- Only run if the accountManagerId column exists on Client
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Client' AND column_name = 'accountManagerId'
  ) THEN
    UPDATE "Client" c
    SET "accountManagerId" = sub."accountManagerId"
    FROM (
      SELECT DISTINCT ON (s."clientId") 
        s."clientId", s."accountManagerId"
      FROM "Site" s
      WHERE s."accountManagerId" IS NOT NULL
      ORDER BY s."clientId", s."updatedAt" DESC
    ) sub
    WHERE c.id = sub."clientId"
    AND c."accountManagerId" IS NULL;
    
    RAISE NOTICE 'Migrated accountManagerId from Site to Client';
  END IF;
END $$;

-- 5. Create default expense item templates
INSERT INTO "ExpenseItemTemplate" (id, name, "sortOrder", "createdAt", "updatedAt")
VALUES 
  (gen_random_uuid(), 'Налог', 0, NOW(), NOW()),
  (gen_random_uuid(), 'SEO Специалист', 1, NOW(), NOW()),
  (gen_random_uuid(), 'Аккаунт-менеджер', 2, NOW(), NOW()),
  (gen_random_uuid(), 'Подрядчик', 3, NOW(), NOW()),
  (gen_random_uuid(), 'Программист', 4, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
