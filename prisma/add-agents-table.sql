-- Добавление справочника агентов/партнёров и связи с клиентами
-- Выполнить: psql "$DATABASE_URL" -f prisma/add-agents-table.sql

-- Enum для источника агента
DO $$ BEGIN
  CREATE TYPE "AgentSource" AS ENUM ('PARTNER', 'AGENT', 'REFERRER', 'EMPLOYEE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Enum для статуса агента
DO $$ BEGIN
  CREATE TYPE "AgentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Таблица агентов
CREATE TABLE IF NOT EXISTS "Agent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "companyName" TEXT,
  "professionalActivity" TEXT,
  "phone" TEXT,
  "telegram" TEXT,
  "position" TEXT,
  "commissionOnTop" BOOLEAN NOT NULL DEFAULT false,
  "commissionInOurAmount" BOOLEAN NOT NULL DEFAULT false,
  "desiredCommissionPercent" DOUBLE PRECISION,
  "sellsOnBehalfOfCompany" BOOLEAN NOT NULL DEFAULT false,
  "transfersForClosingToUs" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "source" "AgentSource",
  "status" "AgentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Agent_name_idx" ON "Agent"("name");
CREATE INDEX IF NOT EXISTS "Agent_phone_idx" ON "Agent"("phone");
CREATE INDEX IF NOT EXISTS "Agent_telegram_idx" ON "Agent"("telegram");
CREATE INDEX IF NOT EXISTS "Agent_status_idx" ON "Agent"("status");

-- Колонка агента у клиента (если ещё нет)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Client' AND column_name = 'agentId'
  ) THEN
    ALTER TABLE "Client" ADD COLUMN "agentId" TEXT;
    CREATE INDEX "Client_agentId_idx" ON "Client"("agentId");
    ALTER TABLE "Client" ADD CONSTRAINT "Client_agentId_fkey"
      FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
