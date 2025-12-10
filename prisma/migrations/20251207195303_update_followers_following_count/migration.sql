-- Update followers_count
UPDATE users u
SET followers_count = sub.cnt
FROM (
  SELECT followed_id, COUNT(*) AS cnt
  FROM follows
  GROUP BY followed_id
) sub
WHERE u.id = sub.followed_id;

-- Update following_count
UPDATE users u
SET following_count = sub.cnt
FROM (
  SELECT follower_id, COUNT(*) AS cnt
  FROM follows
  GROUP BY follower_id
) sub
WHERE u.id = sub.follower_id;