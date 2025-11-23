/*
  Warnings:

  - You are about to drop the column `isHashtag` on the `trending_keywords` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[keyword,is_hashtag]` on the table `trending_keywords` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."trending_keywords_keyword_isHashtag_key";

-- AlterTable
ALTER TABLE "trending_keywords" DROP COLUMN "isHashtag",
ADD COLUMN     "is_hashtag" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "trending_keywords_keyword_is_hashtag_key" ON "trending_keywords"("keyword", "is_hashtag");
