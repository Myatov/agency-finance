-- Добавить колонку legalEntityId в Expense (юрлицо для расхода).
-- Идемпотентно: можно запускать повторно.

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT;
CREATE INDEX IF NOT EXISTS "Expense_legalEntityId_idx" ON "Expense"("legalEntityId");
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'Expense'
    AND constraint_name = 'Expense_legalEntityId_fkey'
  ) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_legalEntityId_fkey"
    FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
