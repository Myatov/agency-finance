-- Income: привязка дохода к периоду работ (опционально)
ALTER TABLE "Income"
  ADD COLUMN IF NOT EXISTS "workPeriodId" TEXT REFERENCES "WorkPeriod"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Income_workPeriodId_idx" ON "Income"("workPeriodId");
