-- Add status fields to Client (returning client, key client, comments)
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "isReturningClient" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "isKeyClient" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "keyClientStatusComment" TEXT,
  ADD COLUMN IF NOT EXISTS "returningClientStatusComment" TEXT;
