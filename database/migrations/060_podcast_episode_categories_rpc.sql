-- Migration: Expose episode categories on public list/detail RPCs (topic chips).
-- Run after 059_podcast_episode_about.sql.

-- Return shape change: drop + create.
DROP FUNCTION IF EXISTS get_episodes_published(INT, INT);

CREATE FUNCTION get_episodes_published(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    slug TEXT,
    title TEXT,
    description TEXT,
    image_url TEXT,
    published_at TIMESTAMPTZ,
    duration_seconds INT,
    audio_url TEXT,
    created_at TIMESTAMPTZ,
    categories JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.slug,
        e.title,
        e.description,
        e.image_url,
        e.published_at,
        e.duration_seconds,
        e.audio_url,
        e.created_at,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object('slug', c.slug, 'name', c.name)
                    ORDER BY c.name
                )
                FROM episode_categories ec
                INNER JOIN podcast_categories c ON c.id = ec.category_id
                WHERE ec.episode_id = e.id
            ),
            '[]'::jsonb
        ) AS categories
    FROM podcast_episodes e
    WHERE e.status = 'published' AND e.published_at IS NOT NULL
    ORDER BY e.published_at DESC, e.order_index ASC, e.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

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
    episode_images JSONB,
    categories JSONB
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
        ) AS episode_images,
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object('slug', c.slug, 'name', c.name)
                    ORDER BY c.name
                )
                FROM episode_categories ec
                INNER JOIN podcast_categories c ON c.id = ec.category_id
                WHERE ec.episode_id = e.id
            ),
            '[]'::jsonb
        ) AS categories
    FROM podcast_episodes e
    WHERE e.slug = p_slug AND e.status = 'published' AND e.published_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
