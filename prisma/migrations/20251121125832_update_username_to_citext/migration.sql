-- 0. Enable extension
CREATE EXTENSION IF NOT EXISTS citext;

-- 1. Drop existing index
DROP INDEX IF EXISTS "users_username_key";

-- 2. Alter column type safely
ALTER TABLE "users"
  ALTER COLUMN "username" TYPE citext USING "username"::citext;

-- 3. Create new index
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

