
-- 0. Enable extension
CREATE EXTENSION IF NOT EXISTS citext;

-- 1. Drop existing index
DROP INDEX IF EXISTS "users_email_key";

-- 2. Alter column type safely
ALTER TABLE "users"
  ALTER COLUMN "email" TYPE citext USING "email"::citext;

-- 3. Create new index
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");


