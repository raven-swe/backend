WITH
  replies AS (
    SELECT reply_to_tweet_id AS id, COUNT(*) AS cnt
    FROM tweets
    WHERE reply_to_tweet_id IS NOT NULL
    GROUP BY reply_to_tweet_id
  ),
  retweets AS (
    SELECT tweet_id AS id, COUNT(*) AS cnt
    FROM retweets
    GROUP BY tweet_id
  ),
  quotes AS (
    SELECT quoted_tweet_id AS id, COUNT(*) AS cnt
    FROM tweets
    WHERE quoted_tweet_id IS NOT NULL
    GROUP BY quoted_tweet_id
  ),
  counts AS (
    SELECT
      t.id,
      COALESCE(r.cnt, 0) AS reply_cnt,
      COALESCE(rt.cnt, 0) + COALESCE(q.cnt, 0) AS retweet_cnt
    FROM tweets t
    LEFT JOIN replies r ON t.id = r.id
    LEFT JOIN retweets rt ON t.id = rt.id
    LEFT JOIN quotes q ON t.id = q.id
  )
UPDATE tweets
SET
  reply_count = counts.reply_cnt,
  retweet_count = counts.retweet_cnt
FROM counts
WHERE tweets.id = counts.id;

-- the left joins are to ensure tweets with zero replies/retweets/quotes are counted as zero