-- CreateIndex
CREATE INDEX "tweets_class_created_at_id_idx" ON "tweets"("class", "created_at" DESC, "id" DESC);
