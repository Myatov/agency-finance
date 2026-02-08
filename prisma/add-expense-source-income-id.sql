-- Связь расхода с доходом (массовые налоговые расходы, защита от дублей)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "sourceIncomeId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_sourceIncomeId_key" ON "Expense"("sourceIncomeId");
CREATE INDEX IF NOT EXISTS "Expense_sourceIncomeId_idx" ON "Expense"("sourceIncomeId");
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_sourceIncomeId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_sourceIncomeId_fkey"
  FOREIGN KEY ("sourceIncomeId") REFERENCES "Income"("id") ON DELETE SET NULL ON UPDATE CASCADE;
