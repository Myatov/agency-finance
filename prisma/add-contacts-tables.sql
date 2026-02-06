-- Contacts and ClientContact tables
CREATE TYPE "ContactRoleAtClient" AS ENUM ('OWNER', 'MARKETING', 'FINANCE', 'IT', 'OTHER');

CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone1" TEXT,
    "phone2" TEXT,
    "birthDate" TIMESTAMP(3),
    "telegram" TEXT,
    "whatsapp" TEXT,
    "position" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "ContactRoleAtClient" DEFAULT 'OTHER',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_name_idx" ON "Contact"("name");
CREATE INDEX "Contact_phone1_idx" ON "Contact"("phone1");
CREATE INDEX "Contact_telegram_idx" ON "Contact"("telegram");
CREATE INDEX "Contact_whatsapp_idx" ON "Contact"("whatsapp");

CREATE UNIQUE INDEX "ClientContact_clientId_contactId_key" ON "ClientContact"("clientId", "contactId");
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");
CREATE INDEX "ClientContact_contactId_idx" ON "ClientContact"("contactId");

ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
