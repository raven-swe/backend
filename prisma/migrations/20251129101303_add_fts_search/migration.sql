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
    search_doc := setweight(to_tsvector('english', COALESCE(content, '')), 'A');

    -- Weight B: Author username and display name
    SELECT u.username, p.display_name
    INTO author_username, author_display_name
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = user_id;

    IF author_username IS NOT NULL THEN
        search_doc := search_doc || setweight(to_tsvector('english', author_username), 'B');
    END IF;

    IF author_display_name IS NOT NULL THEN
        search_doc := search_doc || setweight(to_tsvector('english', author_display_name), 'B');
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
            search_doc := search_doc || setweight(to_tsvector('english', parent_author_username), 'C');
        END IF;

        IF parent_author_display_name IS NOT NULL THEN
            search_doc := search_doc || setweight(to_tsvector('english', parent_author_display_name), 'C');
        END IF;
    END IF;

    RETURN search_doc;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE INDEX IF NOT EXISTS tweets_search_document_idx ON "tweets" USING GIN (search_document);