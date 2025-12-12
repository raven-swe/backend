-- CreateIndex
CREATE INDEX "trending_keywords_keyword_count_idx" ON "trending_keywords"("keyword", "count" DESC);

-- CreateIndex
CREATE INDEX "trending_keywords_keyword_idx" ON "trending_keywords"("keyword");
