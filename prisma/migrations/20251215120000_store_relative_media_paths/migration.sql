-- This migration updates media URLs in the database to be relative paths instead of absolute URLs.
UPDATE media
SET url = regexp_replace(url, '^https?://[^/]+/', '')
WHERE url ~ '^https?://[^/]+/((avatars|banners|tweets|messages)/|default_avatar\.png$)';
UPDATE profiles
SET avatar_url = regexp_replace(avatar_url, '^https?://[^/]+/', '')
WHERE avatar_url ~ '^https?://[^/]+/((avatars|banners|tweets|messages)/|default_avatar\.png$)';
UPDATE profiles
SET banner_url = regexp_replace(banner_url, '^https?://[^/]+/', '')
WHERE banner_url ~ '^https?://[^/]+/((avatars|banners|tweets|messages)/|default_avatar\.png$)';
UPDATE messages
SET media_url = regexp_replace(media_url, '^https?://[^/]+/', '')
WHERE media_url ~ '^https?://[^/]+/((avatars|banners|tweets|messages)/|default_avatar\.png$)';
-- Notification payloads embed a preview of the actors, each carrying an avatar.
UPDATE notifications
SET payload = jsonb_set(
    payload,
    '{actorsPreview}',
    (
      SELECT jsonb_agg(
          CASE
            WHEN actor->>'avatarUrl' ~ '^https?://[^/]+/((avatars|banners|tweets|messages)/|default_avatar\.png$)' THEN jsonb_set(
              actor,
              '{avatarUrl}',
              to_jsonb(
                regexp_replace(actor->>'avatarUrl', '^https?://[^/]+/', '')
              )
            )
            ELSE actor
          END
          ORDER BY ordinality
        )
      FROM jsonb_array_elements(payload->'actorsPreview') WITH ORDINALITY AS entry(actor, ordinality)
    )
  )
WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(payload->'actorsPreview') AS entry(actor)
    WHERE actor->>'avatarUrl' ~ '^https?://[^/]+/((avatars|banners|tweets|messages)/|default_avatar\.png$)'
  );
