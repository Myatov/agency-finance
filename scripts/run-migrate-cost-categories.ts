/**
 * Применяет миграцию migrate-to-cost-categories.sql к БД через Prisma.
 * Запуск: npx tsx scripts/run-migrate-cost-categories.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEMP_TABLE = 'CostCategoryNew';

async function run(sql: string, label: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
    console.log('OK:', label);
  } catch (e: any) {
    if (e.meta?.code === '42P07' || e.message?.includes('already exists')) console.log('Skip:', label);
    else throw e;
  }
}

async function main() {
  // Создаём таблицу категорий под временным именем (enum "CostCategory" мешает таблице с тем же именем)
  await run(
    `CREATE TABLE IF NOT EXISTS "${TEMP_TABLE}" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" TEXT NOT NULL UNIQUE,
      "sortOrder" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    'CostCategory (temp) table'
  );
  await run(
    `CREATE INDEX IF NOT EXISTS "${TEMP_TABLE}_sortOrder_idx" ON "${TEMP_TABLE}"("sortOrder")`,
    'CostCategory (temp) index'
  );

  await run(
    `INSERT INTO "${TEMP_TABLE}" ("id", "name", "sortOrder") VALUES
      (gen_random_uuid(), 'Зарплата', 0),
      (gen_random_uuid(), 'Проценты с продаж', 1),
      (gen_random_uuid(), 'Офис', 2),
      (gen_random_uuid(), 'HR', 3),
      (gen_random_uuid(), 'Агентские выплаты', 4),
      (gen_random_uuid(), 'Сервисы', 5),
      (gen_random_uuid(), 'Ссылки', 6),
      (gen_random_uuid(), 'Подрядчик', 7),
      (gen_random_uuid(), 'Другие расходы', 8)
    ON CONFLICT ("name") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder";`,
    'CostCategory seed'
  );

  await run(
    `CREATE TABLE IF NOT EXISTS "FinancialModelExpenseType" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" TEXT NOT NULL UNIQUE,
      "sortOrder" INT NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    'FinancialModelExpenseType table'
  );
  await run(
    `CREATE INDEX IF NOT EXISTS "FinancialModelExpenseType_sortOrder_idx" ON "FinancialModelExpenseType"("sortOrder")`,
    'FinancialModelExpenseType index'
  );

  await run(
    `INSERT INTO "FinancialModelExpenseType" ("id", "name", "sortOrder") VALUES
      (gen_random_uuid(), 'Постоянные расходы', 0),
      (gen_random_uuid(), 'Переменные расходы', 1)
    ON CONFLICT ("name") DO NOTHING;`,
    'FinancialModelExpenseType seed'
  );

  const doBlock = `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'CostItem' AND column_name = 'category'
      ) THEN
        ALTER TABLE "CostItem" ADD COLUMN IF NOT EXISTS "costCategoryId" UUID;
        ALTER TABLE "CostItem" ADD COLUMN IF NOT EXISTS "financialModelExpenseTypeId" UUID;

        UPDATE "CostItem" ci
        SET "costCategoryId" = cc."id"
        FROM "${TEMP_TABLE}" cc
        WHERE cc."name" = CASE ci."category"::text
          WHEN 'SALARY' THEN 'Зарплата'
          WHEN 'SALES_PERCENT' THEN 'Проценты с продаж'
          WHEN 'OFFICE' THEN 'Офис'
          WHEN 'HR' THEN 'HR'
          WHEN 'AGENCY_PAYMENTS' THEN 'Агентские выплаты'
          WHEN 'SERVICES' THEN 'Сервисы'
          WHEN 'LINKS' THEN 'Ссылки'
          WHEN 'CONTRACTOR' THEN 'Подрядчик'
          WHEN 'OTHER' THEN 'Другие расходы'
          ELSE 'Другие расходы'
        END
        AND ci."costCategoryId" IS NULL;

        UPDATE "CostItem"
        SET "financialModelExpenseTypeId" = (SELECT "id" FROM "FinancialModelExpenseType" ORDER BY "sortOrder" LIMIT 1)
        WHERE "financialModelExpenseTypeId" IS NULL;

        ALTER TABLE "CostItem" ALTER COLUMN "costCategoryId" SET NOT NULL;
        ALTER TABLE "CostItem" ALTER COLUMN "financialModelExpenseTypeId" SET NOT NULL;
        ALTER TABLE "CostItem" DROP CONSTRAINT IF EXISTS "CostItem_costCategoryId_fkey";
        ALTER TABLE "CostItem" DROP CONSTRAINT IF EXISTS "CostItem_financialModelExpenseTypeId_fkey";

        ALTER TABLE "CostItem" DROP COLUMN "category";
        DROP TYPE IF EXISTS "CostCategory";

        ALTER TABLE "${TEMP_TABLE}" RENAME TO "CostCategory";

        ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_costCategoryId_fkey"
          FOREIGN KEY ("costCategoryId") REFERENCES "CostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_financialModelExpenseTypeId_fkey"
          FOREIGN KEY ("financialModelExpenseTypeId") REFERENCES "FinancialModelExpenseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        CREATE INDEX IF NOT EXISTS "CostItem_costCategoryId_idx" ON "CostItem"("costCategoryId");
        CREATE INDEX IF NOT EXISTS "CostItem_financialModelExpenseTypeId_idx" ON "CostItem"("financialModelExpenseTypeId");
      ELSIF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CostCategory')
        AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '${TEMP_TABLE}')
      THEN
        ALTER TABLE "${TEMP_TABLE}" RENAME TO "CostCategory";
      END IF;
    END $$;
  `;
  await prisma.$executeRawUnsafe(doBlock);
  console.log('OK: CostItem backfill and rename');

  console.log('Migration done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
