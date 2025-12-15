-- users username FTS index
CREATE INDEX IF NOT EXISTS username_search_fts_idx 
ON users USING GIN (to_tsvector('simple', username));

-- profiles display_name FTS index
CREATE INDEX IF NOT EXISTS user_display_name_search_fts_idx 
ON profiles USING GIN (to_tsvector('simple', display_name));
