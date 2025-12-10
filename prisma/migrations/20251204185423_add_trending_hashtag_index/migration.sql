-- CreateIndex
CREATE INDEX "trending_hashtags_search_idx" ON "trending_keywords"("is_hashtag", "keyword", "count" DESC);
