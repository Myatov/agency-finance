-- Миграция: замена enum CostCategory на таблицы CostCategory и FinancialModelExpenseType.
-- Выполнить на сервере один раз перед или вместо db push (если в CostItem уже есть данные).

-- 1) Таблица категорий расходов (верхний уровень)
CREATE TABLE IF NOT EXISTS "CostCategory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "CostCategory_sortOrder_idx" ON "CostCategory"("sortOrder");

-- 2) Таблица видов расходов для финмодели
CREATE TABLE IF NOT EXISTS "FinancialModelExpenseType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL UNIQUE,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "FinancialModelExpenseType_sortOrder_idx" ON "FinancialModelExpenseType"("sortOrder");

-- 3) Наполнение категорий (соответствие старому enum)
INSERT INTO "CostCategory" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid(), 'Зарплата', 0),
  (gen_random_uuid(), 'Проценты с продаж', 1),
  (gen_random_uuid(), 'Офис', 2),
  (gen_random_uuid(), 'HR', 3),
  (gen_random_uuid(), 'Агентские выплаты', 4),
  (gen_random_uuid(), 'Сервисы', 5),
  (gen_random_uuid(), 'Ссылки', 6),
  (gen_random_uuid(), 'Подрядчик', 7),
  (gen_random_uuid(), 'Другие расходы', 8)
ON CONFLICT ("name") DO UPDATE SET "sortOrder" = EXCLUDED."sortOrder";

-- 4) Наполнение видов для финмодели
INSERT INTO "FinancialModelExpenseType" ("id", "name", "sortOrder") VALUES
  (gen_random_uuid(), 'Постоянные расходы', 0),
  (gen_random_uuid(), 'Переменные расходы', 1)
ON CONFLICT ("name") DO NOTHING;

-- 5) Добавить новые колонки в CostItem (если ещё есть старая колонка category)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CostItem' AND column_name = 'category'
  ) THEN
    ALTER TABLE "CostItem" ADD COLUMN IF NOT EXISTS "costCategoryId" UUID;
    ALTER TABLE "CostItem" ADD COLUMN IF NOT EXISTS "financialModelExpenseTypeId" UUID;

    -- 6) Заполнить costCategoryId по старому enum
    UPDATE "CostItem" ci
    SET "costCategoryId" = cc."id"
    FROM "CostCategory" cc
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
    WHERE ci."costCategoryId" IS NULL;

    -- 7) Заполнить financialModelExpenseTypeId (по умолчанию — первый вид)
    UPDATE "CostItem"
    SET "financialModelExpenseTypeId" = (SELECT "id" FROM "FinancialModelExpenseType" ORDER BY "sortOrder" LIMIT 1)
    WHERE "financialModelExpenseTypeId" IS NULL;

    -- 8) Сделать колонки обязательными и удалить старую
    ALTER TABLE "CostItem" ALTER COLUMN "costCategoryId" SET NOT NULL;
    ALTER TABLE "CostItem" ALTER COLUMN "financialModelExpenseTypeId" SET NOT NULL;
    ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_costCategoryId_fkey"
      FOREIGN KEY ("costCategoryId") REFERENCES "CostCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    ALTER TABLE "CostItem" ADD CONSTRAINT "CostItem_financialModelExpenseTypeId_fkey"
      FOREIGN KEY ("financialModelExpenseTypeId") REFERENCES "FinancialModelExpenseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    CREATE INDEX IF NOT EXISTS "CostItem_costCategoryId_idx" ON "CostItem"("costCategoryId");
    CREATE INDEX IF NOT EXISTS "CostItem_financialModelExpenseTypeId_idx" ON "CostItem"("financialModelExpenseTypeId");

    ALTER TABLE "CostItem" DROP COLUMN "category";
    DROP TYPE IF EXISTS "CostCategory";
  END IF;
END $$;
