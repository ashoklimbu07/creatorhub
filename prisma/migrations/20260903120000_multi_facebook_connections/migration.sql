-- AddColumn
ALTER TABLE "platform_connections" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: at this point the old (userId, platform) unique constraint still
-- exists, so there is exactly one row per user+platform group — marking all
-- of them default is unambiguous.
UPDATE "platform_connections" SET "isDefault" = true;

-- DropIndex
DROP INDEX "platform_connections_userId_platform_key";

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_userId_platform_externalAccountId_key" ON "platform_connections"("userId", "platform", "externalAccountId");

-- CreateIndex
CREATE INDEX "platform_connections_userId_platform_idx" ON "platform_connections"("userId", "platform");

-- CreateIndex
-- Hand-maintained partial unique index: Prisma's schema DSL can't express a
-- WHERE clause on an index, so this is not represented in schema.prisma and
-- will not be reproduced by `prisma migrate dev` diffing — keep it if this
-- migration is ever regenerated or squashed.
CREATE UNIQUE INDEX "platform_connections_one_default_per_user_platform" ON "platform_connections"("userId", "platform") WHERE "isDefault" = true;
