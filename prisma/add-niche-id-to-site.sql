-- Добавление поля nicheId в таблицу Site если его нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Site' AND column_name = 'nicheId'
    ) THEN
        ALTER TABLE "Site" ADD COLUMN "nicheId" TEXT;
        CREATE INDEX IF NOT EXISTS "Site_nicheId_idx" ON "Site"("nicheId");
        
        -- Добавление внешнего ключа если его нет
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'Site_nicheId_fkey'
        ) THEN
            ALTER TABLE "Site" ADD CONSTRAINT "Site_nicheId_fkey" 
            FOREIGN KEY ("nicheId") REFERENCES "Niche"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
