
DROP TRIGGER IF EXISTS users_search_document_update ON users;
DROP TRIGGER IF EXISTS profiles_search_document_update ON profiles;

DROP FUNCTION IF EXISTS update_tweets_search_document_on_user_change();

CREATE OR REPLACE FUNCTION update_tweets_search_document_on_user_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tweets
    SET search_document = build_tweet_search_document(
        id,
        content,
        user_id,
        reply_to_tweet_id
    )
    WHERE user_id = NEW.id; 
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_tweets_search_document_on_profile_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE tweets
    SET search_document = build_tweet_search_document(
        id,
        content,
        user_id,
        reply_to_tweet_id
    )
    WHERE user_id = NEW.user_id; 
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_search_document_update
AFTER UPDATE ON users FOR EACH ROW
WHEN (OLD.username IS DISTINCT FROM NEW.username)
EXECUTE FUNCTION update_tweets_search_document_on_user_change();

CREATE TRIGGER profiles_search_document_update
AFTER UPDATE ON profiles FOR EACH ROW
WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name)
EXECUTE FUNCTION update_tweets_search_document_on_profile_change();

-- Recreate trigram indexes with LOWER() function
DROP INDEX IF EXISTS users_username_trgm_idx;
DROP INDEX IF EXISTS profiles_display_name_trgm_idx;

CREATE INDEX users_username_trgm_idx ON "users" USING GIN (LOWER(username) gin_trgm_ops);
CREATE INDEX profiles_display_name_trgm_idx ON "profiles" USING GIN (LOWER(display_name) gin_trgm_ops);