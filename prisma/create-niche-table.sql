-- Создание таблицы Niche если она не существует
CREATE TABLE IF NOT EXISTS "Niche" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Niche_pkey" PRIMARY KEY ("id")
);

-- Создание уникального индекса на name если его нет
CREATE UNIQUE INDEX IF NOT EXISTS "Niche_name_key" ON "Niche"("name");

-- Создание индекса на sortOrder если его нет
CREATE INDEX IF NOT EXISTS "Niche_sortOrder_idx" ON "Niche"("sortOrder");

-- Добавление поля parentId если его нет
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Niche' AND column_name = 'parentId'
    ) THEN
        ALTER TABLE "Niche" ADD COLUMN "parentId" TEXT;
        CREATE INDEX IF NOT EXISTS "Niche_parentId_idx" ON "Niche"("parentId");
        
        -- Добавление внешнего ключа если его нет
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'Niche_parentId_fkey'
        ) THEN
            ALTER TABLE "Niche" ADD CONSTRAINT "Niche_parentId_fkey" 
            FOREIGN KEY ("parentId") REFERENCES "Niche"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
