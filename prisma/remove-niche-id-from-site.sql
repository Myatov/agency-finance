-- Удаление поля nicheId из таблицы Site (ниша хранится только в поле niche).
-- Запускать после деплоя кода, который не использует nicheId.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Site' AND column_name = 'nicheId'
    ) THEN
        ALTER TABLE "Site" DROP CONSTRAINT IF EXISTS "Site_nicheId_fkey";
        DROP INDEX IF EXISTS "Site_nicheId_idx";
        ALTER TABLE "Site" DROP COLUMN "nicheId";
    END IF;
END $$;
