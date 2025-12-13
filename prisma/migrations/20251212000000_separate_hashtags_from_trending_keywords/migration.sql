-- AlterTable: Remove TweetHashtag relation from TrendingKeyword (structure only, data preserved)
-- CreateTable: Create new hashtags table for non-trending hashtag usage
CREATE TABLE "hashtags" (
    "id" BIGSERIAL NOT NULL,
    "keyword" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hashtags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hashtags_keyword_key" ON "hashtags"("keyword");

-- Migrate hashtag data from trending_keywords to hashtags table
-- Only migrate hashtags (isHashtag = true) from trending_keywords
INSERT INTO "hashtags" ("keyword", "created_at")
SELECT DISTINCT "keyword", MIN("created_at")
FROM "trending_keywords"
WHERE "is_hashtag" = true
GROUP BY "keyword";

-- Store old hashtag_id mapping in a temporary table for reference
CREATE TEMP TABLE "temp_hashtag_id_mapping" AS
SELECT tk.id as old_id, h.id as new_id
FROM "trending_keywords" tk
INNER JOIN "hashtags" h ON tk.keyword = h.keyword
WHERE tk."is_hashtag" = true;

-- Drop the foreign key constraint on tweet_hashtags
ALTER TABLE "tweet_hashtags" DROP CONSTRAINT "tweet_hashtags_hashtag_id_fkey";

-- Update tweet_hashtags to reference the new hashtags table
UPDATE "tweet_hashtags" th
SET "hashtag_id" = m.new_id
FROM "temp_hashtag_id_mapping" m
WHERE th."hashtag_id" = m.old_id;

-- AddForeignKey: Add foreign key to reference the new hashtags table
ALTER TABLE "tweet_hashtags" ADD CONSTRAINT "tweet_hashtags_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "hashtags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Clear all trending_keywords to start fresh for scoring purposes
-- The hashtag data is now safely stored in the hashtags table
DELETE FROM "trending_keywords";
