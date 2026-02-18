-- Расходы по периоду (могут отличаться от статей услуги)
CREATE TABLE IF NOT EXISTS "WorkPeriodExpenseItem" (
    "id" TEXT NOT NULL,
    "workPeriodId" TEXT NOT NULL,
    "expenseItemTemplateId" TEXT,
    "responsibleUserId" TEXT,
    "name" TEXT NOT NULL,
    "valueType" "ExpenseItemValueType" NOT NULL DEFAULT 'PERCENT',
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedAmount" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkPeriodExpenseItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkPeriodExpenseItem_workPeriodId_idx" ON "WorkPeriodExpenseItem"("workPeriodId");
CREATE INDEX IF NOT EXISTS "WorkPeriodExpenseItem_responsibleUserId_idx" ON "WorkPeriodExpenseItem"("responsibleUserId");

ALTER TABLE "WorkPeriodExpenseItem" DROP CONSTRAINT IF EXISTS "WorkPeriodExpenseItem_workPeriodId_fkey";
ALTER TABLE "WorkPeriodExpenseItem" ADD CONSTRAINT "WorkPeriodExpenseItem_workPeriodId_fkey" FOREIGN KEY ("workPeriodId") REFERENCES "WorkPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkPeriodExpenseItem" DROP CONSTRAINT IF EXISTS "WorkPeriodExpenseItem_expenseItemTemplateId_fkey";
ALTER TABLE "WorkPeriodExpenseItem" ADD CONSTRAINT "WorkPeriodExpenseItem_expenseItemTemplateId_fkey" FOREIGN KEY ("expenseItemTemplateId") REFERENCES "ExpenseItemTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkPeriodExpenseItem" DROP CONSTRAINT IF EXISTS "WorkPeriodExpenseItem_responsibleUserId_fkey";
ALTER TABLE "WorkPeriodExpenseItem" ADD CONSTRAINT "WorkPeriodExpenseItem_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
