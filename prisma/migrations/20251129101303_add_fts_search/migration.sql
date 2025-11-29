CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- This is an empty migration.
ALTER TABLE "tweets" ADD COLUMN IF NOT EXISTS search_document tsvector;

CREATE OR REPLACE FUNCTION build_tweet_search_document(
    tweet_id BIGINT,    
    content TEXT,
    user_id BIGINT,
    reply_to_tweet_id BIGINT
) RETURNS tsvector AS $$
DECLARE
    search_doc tsvector := to_tsvector('');
    author_username TEXT;
    author_display_name TEXT;
    parent_author_username TEXT;
    parent_author_display_name TEXT;
BEGIN
    -- Weight A: Tweet content
    search_doc := setweight(to_tsvector('simple', COALESCE(content, '')), 'A');

    -- Weight B: Author username and display name
    SELECT u.username, p.display_name
    INTO author_username, author_display_name
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = user_id;

    IF author_username IS NOT NULL THEN
        search_doc := search_doc || setweight(to_tsvector('simple', author_username), 'B');
    END IF;

    IF author_display_name IS NOT NULL THEN
        search_doc := search_doc || setweight(to_tsvector('simple', author_display_name), 'B');
    END IF;

    -- Weight C: Parent tweet author's username and display name
    IF reply_to_tweet_id IS NOT NULL THEN
        SELECT u.username, p.display_name
        INTO parent_author_username, parent_author_display_name
        FROM tweets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE t.id = reply_to_tweet_id;

        IF parent_author_username IS NOT NULL THEN
            search_doc := search_doc || setweight(to_tsvector('simple', parent_author_username), 'C');
        END IF;

        IF parent_author_display_name IS NOT NULL THEN
            search_doc := search_doc || setweight(to_tsvector('simple', parent_author_display_name), 'C');
        END IF;
    END IF;

    RETURN search_doc;
END;
$$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION tweets_search_document_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_document := build_tweet_search_document(
        NEW.id,
        NEW.content,
        NEW.user_id,
        NEW.reply_to_tweet_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tweets_search_document_update
BEFORE INSERT ON tweets FOR EACH ROW
EXECUTE FUNCTION tweets_search_document_trigger();

-- Trigger for username/display name updates
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

CREATE TRIGGER users_search_document_update
AFTER UPDATE ON users FOR EACH ROW
WHEN (OLD.username IS DISTINCT FROM NEW.username)
EXECUTE FUNCTION update_tweets_search_document_on_user_change();

CREATE TRIGGER profiles_search_document_update
AFTER UPDATE ON profiles FOR EACH ROW
WHEN (OLD.display_name IS DISTINCT FROM NEW.display_name)
EXECUTE FUNCTION update_tweets_search_document_on_user_change();

ANALYZE "tweets";
ANALYZE "users";
ANALYZE "profiles";

CREATE INDEX IF NOT EXISTS tweets_search_document_idx ON "tweets" USING GIN (search_document);

-- Trigram indexes for user search
CREATE INDEX IF NOT EXISTS users_username_trgm_idx ON "users" USING GIN (username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS profiles_display_name_trgm_idx ON "profiles" USING GIN (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tweets_created_at ON "tweets" (created_at DESC) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS tweets_with_media ON "tweets" (created_at DESC) WHERE has_media = true AND is_deleted = false;
