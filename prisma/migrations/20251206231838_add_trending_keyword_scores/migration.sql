/*
  Warnings:

  - You are about to drop the column `category` on the `trending_keywords` table. All the data in the column will be lost.
  - You are about to drop the column `count` on the `trending_keywords` table. All the data in the column will be lost.
  - You are about to drop the column `search_document` on the `tweets` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "Categories" ADD VALUE 'GENERAL';

-- AlterTable
ALTER TABLE "trending_keywords"
    RENAME COLUMN "count" TO "occurrence_count";
ALTER TABLE "trending_keywords"
    ADD COLUMN "overall_score" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
    
-- CreateTable
CREATE TABLE "trending_keyword_categories" (
    "id" BIGSERIAL NOT NULL,
    "trendingKeywordId" BIGINT NOT NULL,
    "category" "Categories" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "occurrence_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "trending_keyword_categories_pkey" PRIMARY KEY ("id")
);

-- Copy existing category data into the new table
INSERT INTO "trending_keyword_categories"
  ("trendingKeywordId", "category", "score", "occurrence_count")
SELECT
  "id"              AS "trendingKeywordId",
  "category",
  0.0               AS "score",
  "occurrence_count"
FROM "trending_keywords"
WHERE "category" IS NOT NULL;


-- CreateIndex
CREATE INDEX "trending_keyword_categories_trendingKeywordId_idx" ON "trending_keyword_categories"("trendingKeywordId");

-- CreateIndex
CREATE UNIQUE INDEX "trending_keyword_categories_trendingKeywordId_category_key" ON "trending_keyword_categories"("trendingKeywordId", "category");

-- CreateIndex
CREATE INDEX "trending_keywords_last_updated_at_idx" ON "trending_keywords"("last_updated_at");

-- AddForeignKey
ALTER TABLE "trending_keyword_categories" ADD CONSTRAINT "trending_keyword_categories_trendingKeywordId_fkey" FOREIGN KEY ("trendingKeywordId") REFERENCES "trending_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;
