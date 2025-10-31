/*
  Warnings:

  - A unique constraint covering the columns `[keyword,isHashtag]` on the table `trending_keywords` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "trending_keywords_keyword_isHashtag_key" ON "trending_keywords"("keyword", "isHashtag");
