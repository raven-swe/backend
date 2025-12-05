-- CreateIndex
CREATE INDEX "tweets_cursor_idx" ON "tweets"("created_at" DESC, "id" DESC);
