-- AlterTable
ALTER TABLE "tweets" ADD COLUMN "root_tweet_id" BIGINT;

-- Populate root_tweet_id for existing replies using a recursive CTE
WITH RECURSIVE tweet_roots AS (
    -- Base case: tweets with no parent (root tweets)
    SELECT id, id AS root_id, reply_to_tweet_id
    FROM tweets
    WHERE reply_to_tweet_id IS NULL

    UNION ALL

    -- Recursive case: find replies and link them to their root tweet
    SELECT t.id, tr.root_id, t.reply_to_tweet_id
    FROM tweets t
    INNER JOIN tweet_roots tr ON t.reply_to_tweet_id = tr.id
    WHERE t.reply_to_tweet_id IS NOT NULL
)
UPDATE tweets
SET root_tweet_id = tr.root_id
FROM tweet_roots tr
WHERE tweets.id = tr.id AND tweets.reply_to_tweet_id IS NOT NULL;

-- CreateIndex
CREATE INDEX "tweets_root_tweet_id_idx" ON "tweets"("root_tweet_id");

-- AddForeignKey
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_root_tweet_id_fkey" FOREIGN KEY ("root_tweet_id") REFERENCES "tweets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
