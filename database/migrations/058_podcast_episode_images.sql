-- Migration: Multiple images per podcast episode
-- Run after 057_podcast_episode_image_description.sql.
--
-- podcast_episode_images holds ordered gallery rows. podcast_episodes.image_url,
-- image_storage_path, and image_description remain denormalized copies of the
-- first image (sort_order ASC, created_at ASC) for RSS and list thumbnails.

CREATE TABLE podcast_episode_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0,
    image_storage_path TEXT,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_podcast_episode_images_episode_sort
    ON podcast_episode_images(episode_id, sort_order ASC, created_at ASC);

CREATE INDEX idx_podcast_episode_images_episode
    ON podcast_episode_images(episode_id);

CREATE TRIGGER update_podcast_episode_images_updated_at
    BEFORE UPDATE ON podcast_episode_images
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE podcast_episode_images ENABLE ROW LEVEL SECURITY;

-- Backfill one row per episode that had any legacy image metadata
INSERT INTO podcast_episode_images (
    episode_id,
    sort_order,
    image_storage_path,
    image_url,
    description
)
SELECT
    e.id,
    0,
    e.image_storage_path,
    e.image_url,
    e.image_description
FROM podcast_episodes e
WHERE
    e.image_url IS NOT NULL
    OR e.image_storage_path IS NOT NULL
    OR e.image_description IS NOT NULL;

-- Replacing get_episode_by_slug changes the RETURNS TABLE shape; CREATE OR REPLACE
-- cannot alter OUT parameter types (PostgreSQL 42P13). Drop first, then create.
DROP FUNCTION IF EXISTS get_episode_by_slug(TEXT);

-- Single episode by slug (published): include ordered gallery as JSONB
CREATE FUNCTION get_episode_by_slug(p_slug TEXT)
RETURNS TABLE(
    id UUID,
    slug TEXT,
    title TEXT,
    description TEXT,
    image_description TEXT,
    show_notes TEXT,
    transcript TEXT,
    published_at TIMESTAMPTZ,
    audio_url TEXT,
    image_url TEXT,
    duration_seconds INT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    episode_images JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.slug,
        e.title,
        e.description,
        e.image_description,
        e.show_notes,
        e.transcript,
        e.published_at,
        e.audio_url,
        e.image_url,
        e.duration_seconds,
        e.created_at,
        e.updated_at,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', i.id,
                        'image_url', i.image_url,
                        'description', i.description,
                        'sort_order', i.sort_order
                    )
                    ORDER BY i.sort_order ASC, i.created_at ASC
                )
                FROM podcast_episode_images i
                WHERE i.episode_id = e.id
            ),
            '[]'::jsonb
        ) AS episode_images
    FROM podcast_episodes e
    WHERE e.slug = p_slug AND e.status = 'published' AND e.published_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
