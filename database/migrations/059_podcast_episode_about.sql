-- Migration: Optional long-form "About the Episode" copy for the public episode page
-- Run after 058_podcast_episode_images.sql.

ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS about_episode TEXT;

-- Extend get_episode_by_slug with about_episode (OUT shape change requires drop + create).
DROP FUNCTION IF EXISTS get_episode_by_slug(TEXT);

CREATE FUNCTION get_episode_by_slug(p_slug TEXT)
RETURNS TABLE(
    id UUID,
    slug TEXT,
    title TEXT,
    description TEXT,
    about_episode TEXT,
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
        e.about_episode,
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
