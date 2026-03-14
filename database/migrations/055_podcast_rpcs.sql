-- Migration: Podcast RPCs for public read and similarity
-- Run after 054_podcast_schema.sql.
--
-- get_episodes_published: list published episodes (for homepage and /episodes)
-- get_episode_by_slug: single episode for episode page
-- get_episodes_by_category: episodes in a category
-- search_episodes_published: full-text search on title, description, show_notes
-- get_similar_episodes: vector similarity for related episodes

-- List published episodes, ordered by published_at DESC then order_index
CREATE OR REPLACE FUNCTION get_episodes_published(
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
    created_at TIMESTAMPTZ
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
        e.created_at
    FROM podcast_episodes e
    WHERE e.status = 'published' AND e.published_at IS NOT NULL
    ORDER BY e.published_at DESC, e.order_index ASC, e.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Single episode by slug (published only)
CREATE OR REPLACE FUNCTION get_episode_by_slug(p_slug TEXT)
RETURNS TABLE(
    id UUID,
    slug TEXT,
    title TEXT,
    description TEXT,
    show_notes TEXT,
    transcript TEXT,
    published_at TIMESTAMPTZ,
    audio_url TEXT,
    image_url TEXT,
    duration_seconds INT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.slug,
        e.title,
        e.description,
        e.show_notes,
        e.transcript,
        e.published_at,
        e.audio_url,
        e.image_url,
        e.duration_seconds,
        e.created_at,
        e.updated_at
    FROM podcast_episodes e
    WHERE e.slug = p_slug AND e.status = 'published' AND e.published_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Episodes in a category (by category slug)
CREATE OR REPLACE FUNCTION get_episodes_by_category(
    p_category_slug TEXT,
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
    created_at TIMESTAMPTZ
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
        e.created_at
    FROM podcast_episodes e
    INNER JOIN episode_categories ec ON e.id = ec.episode_id
    INNER JOIN podcast_categories c ON c.id = ec.category_id AND c.slug = p_category_slug
    WHERE e.status = 'published' AND e.published_at IS NOT NULL
    ORDER BY e.published_at DESC, e.order_index ASC, e.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Full-text search on title, description, show_notes (plainto_tsquery)
CREATE OR REPLACE FUNCTION search_episodes_published(
    p_query TEXT,
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
    created_at TIMESTAMPTZ
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
        e.created_at
    FROM podcast_episodes e
    WHERE e.status = 'published'
      AND e.published_at IS NOT NULL
      AND (
          p_query IS NULL OR p_query = '' OR
          to_tsvector('english', coalesce(e.title, '') || ' ' || coalesce(e.description, '') || ' ' || coalesce(e.show_notes, '')) @@ plainto_tsquery('english', p_query)
      )
    ORDER BY e.published_at DESC, e.order_index ASC, e.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Similar episodes by vector similarity (exclude self, published only)
CREATE OR REPLACE FUNCTION get_similar_episodes(
    p_episode_id UUID,
    p_limit INT DEFAULT 6
)
RETURNS TABLE(
    id UUID,
    slug TEXT,
    title TEXT,
    description TEXT,
    image_url TEXT,
    published_at TIMESTAMPTZ,
    duration_seconds INT,
    similarity DOUBLE PRECISION
) AS $$
DECLARE
    v_embedding extensions.vector(1536);
BEGIN
    SELECT ee.embedding INTO v_embedding
    FROM episode_embeddings ee
    WHERE ee.episode_id = p_episode_id;

    IF v_embedding IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.slug,
        e.title,
        e.description,
        e.image_url,
        e.published_at,
        e.duration_seconds,
        (1 - (ee.embedding <=> v_embedding))::DOUBLE PRECISION AS similarity
    FROM podcast_episodes e
    INNER JOIN episode_embeddings ee ON ee.episode_id = e.id
    WHERE e.id != p_episode_id
      AND e.status = 'published'
      AND e.published_at IS NOT NULL
    ORDER BY ee.embedding <=> v_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, extensions;

-- List all categories (for explore)
CREATE OR REPLACE FUNCTION get_podcast_categories()
RETURNS TABLE(
    id UUID,
    slug TEXT,
    name TEXT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.slug, c.name, c.description
    FROM podcast_categories c
    ORDER BY c.name;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
