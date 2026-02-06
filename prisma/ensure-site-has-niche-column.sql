-- Обязательно: колонка "niche" в Site (ниша хранится только как строка).
-- Запускать первым, если в таблице Site нет колонки niche.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'Site' AND column_name = 'niche'
    ) THEN
        ALTER TABLE "Site" ADD COLUMN "niche" TEXT NOT NULL DEFAULT '';
        -- По возможности заполняем из справочника по старой колонке nicheId
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'Site' AND column_name = 'nicheId'
        ) THEN
            UPDATE "Site" s
            SET "niche" = COALESCE(n.name, '')
            FROM "Niche" n
            WHERE s."nicheId" = n.id AND (s."niche" IS NULL OR s."niche" = '');
        END IF;
    END IF;
END $$;
