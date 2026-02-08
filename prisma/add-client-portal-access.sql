-- Личный кабинет клиента: доступ по ссылке + пароль
CREATE TABLE IF NOT EXISTS "ClientPortalAccess" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalAccess_clientId_key" ON "ClientPortalAccess"("clientId");
CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalAccess_accessToken_key" ON "ClientPortalAccess"("accessToken");
CREATE INDEX IF NOT EXISTS "ClientPortalAccess_accessToken_idx" ON "ClientPortalAccess"("accessToken");
CREATE INDEX IF NOT EXISTS "ClientPortalAccess_clientId_idx" ON "ClientPortalAccess"("clientId");

ALTER TABLE "ClientPortalAccess" DROP CONSTRAINT IF EXISTS "ClientPortalAccess_clientId_fkey";
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClientPortalAccess" DROP CONSTRAINT IF EXISTS "ClientPortalAccess_createdByUserId_fkey";
ALTER TABLE "ClientPortalAccess" ADD CONSTRAINT "ClientPortalAccess_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
