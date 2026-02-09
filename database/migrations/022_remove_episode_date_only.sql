-- Migration: Remove episode_date from posts (keep used_on_episode and mark-as-used)
-- Run this in Supabase SQL Editor after 021_posts_comments.sql
--
-- Drops only the episode_date column. All RPCs are recreated without p_episode_date
-- and without filtering/returning episode_date. used_on_episode is unchanged.

-- ============================================================================
-- Step 1: Drop episode_date column
-- ============================================================================

ALTER TABLE posts DROP COLUMN IF EXISTS episode_date;

-- ============================================================================
-- Step 2: get_posts_with_scores (remove p_episode_date param and WHERE clause)
-- ============================================================================

DROP FUNCTION IF EXISTS get_posts_with_scores(uuid, integer, integer, double precision, text, boolean, uuid, boolean, date, double precision, text, integer);

CREATE OR REPLACE FUNCTION get_posts_with_scores(
    p_weight_config_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_order_by TEXT DEFAULT 'score',
    p_min_reaction_count INT DEFAULT NULL
)
RETURNS TABLE(
    categories TEXT[],
    llm_created_at TIMESTAMPTZ,
    llm_score_id UUID,
    model_version TEXT,
    post_id UUID,
    final_score FLOAT,
    scores JSONB,
    summary TEXT,
    why_podcast_worthy TEXT
) AS $$
BEGIN
    IF p_order_by = 'podcast_worthy' THEN
        RETURN QUERY
        SELECT
            ls.categories,
            ls.created_at AS llm_created_at,
            ls.id AS llm_score_id,
            ls.model_version,
            ps.post_id,
            ps.final_score,
            ls.scores,
            ls.summary,
            ls.why_podcast_worthy
        FROM post_scores ps
        INNER JOIN llm_scores ls ON ps.post_id = ls.post_id
        INNER JOIN posts p ON ps.post_id = p.id
        WHERE ps.weight_config_id = p_weight_config_id
            AND (p_min_score IS NULL OR ps.final_score >= p_min_score)
            AND (p_category IS NULL OR p_category = ANY(ls.categories))
            AND (NOT p_unused_only OR p.used_on_episode = false)
            AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
            AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        ORDER BY (ls.scores->>'podcast_worthy')::float DESC NULLS LAST, ps.final_score DESC
        LIMIT p_limit
        OFFSET p_offset;
    ELSE
        RETURN QUERY
        SELECT
            ls.categories,
            ls.created_at AS llm_created_at,
            ls.id AS llm_score_id,
            ls.model_version,
            ps.post_id,
            ps.final_score,
            ls.scores,
            ls.summary,
            ls.why_podcast_worthy
        FROM post_scores ps
        INNER JOIN llm_scores ls ON ps.post_id = ls.post_id
        INNER JOIN posts p ON ps.post_id = p.id
        WHERE ps.weight_config_id = p_weight_config_id
            AND (p_min_score IS NULL OR ps.final_score >= p_min_score)
            AND (p_category IS NULL OR p_category = ANY(ls.categories))
            AND (NOT p_unused_only OR p.used_on_episode = false)
            AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
            AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
            AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
            AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
        ORDER BY ps.final_score DESC
        LIMIT p_limit
        OFFSET p_offset;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 3: get_posts_with_scores_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_with_scores_count(
    p_weight_config_id UUID,
    p_min_score FLOAT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_unused_only BOOLEAN DEFAULT false,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    result_count INT;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM post_scores ps
    INNER JOIN llm_scores ls ON ps.post_id = ls.post_id
    INNER JOIN posts p ON ps.post_id = p.id
    WHERE ps.weight_config_id = p_weight_config_id
        AND (p_min_score IS NULL OR ps.final_score >= p_min_score)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 4: get_posts_by_date (remove p_episode_date param and WHERE clause)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_by_date(
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_unused_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL
)
RETURNS TABLE(
    categories TEXT[],
    llm_created_at TIMESTAMPTZ,
    llm_score_id UUID,
    model_version TEXT,
    post_id UUID,
    final_score FLOAT,
    scores JSONB,
    summary TEXT,
    why_podcast_worthy TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ls.categories,
        ls.created_at AS llm_created_at,
        ls.id AS llm_score_id,
        ls.model_version,
        p.id AS post_id,
        ls.final_score,
        ls.scores,
        ls.summary,
        ls.why_podcast_worthy
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count)
    ORDER BY p.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 5: get_posts_by_date_count
-- ============================================================================

CREATE OR REPLACE FUNCTION get_posts_by_date_count(
    p_category TEXT DEFAULT NULL,
    p_min_score FLOAT DEFAULT NULL,
    p_neighborhood_id UUID DEFAULT NULL,
    p_saved_only BOOLEAN DEFAULT false,
    p_unused_only BOOLEAN DEFAULT false,
    p_min_podcast_worthy FLOAT DEFAULT NULL,
    p_min_reaction_count INT DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
    result_count INT;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM posts p
    INNER JOIN llm_scores ls ON p.id = ls.post_id
    WHERE (p_neighborhood_id IS NULL OR p.neighborhood_id = p_neighborhood_id)
        AND (NOT p_saved_only OR COALESCE(p.saved, false) = true)
        AND (NOT p_unused_only OR p.used_on_episode = false)
        AND (p_category IS NULL OR p_category = ANY(ls.categories))
        AND (p_min_score IS NULL OR ls.final_score >= p_min_score)
        AND (p_min_podcast_worthy IS NULL OR (ls.scores->>'podcast_worthy')::float >= p_min_podcast_worthy)
        AND (p_min_reaction_count IS NULL OR COALESCE(p.reaction_count, 0) >= p_min_reaction_count);

    RETURN result_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 6: search_posts_by_embedding (remove episode_date from return)
-- ============================================================================

DROP FUNCTION IF EXISTS search_posts_by_embedding(vector, double precision, integer);

CREATE OR REPLACE FUNCTION search_posts_by_embedding(
    query_embedding VECTOR(1536),
    similarity_threshold FLOAT DEFAULT 0.5,
    result_limit INT DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    text TEXT,
    similarity DOUBLE PRECISION,
    created_at TIMESTAMPTZ,
    neighborhood_id UUID,
    post_id_ext TEXT,
    url TEXT,
    user_id_hash TEXT,
    image_urls JSONB,
    hash TEXT,
    used_on_episode BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.text,
        (1 - (pe.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
        p.created_at,
        p.neighborhood_id,
        p.post_id_ext::TEXT,
        p.url::TEXT,
        p.user_id_hash::TEXT,
        p.image_urls,
        p.hash::TEXT,
        COALESCE(p.used_on_episode, false)
    FROM posts p
    INNER JOIN post_embeddings pe ON p.id = pe.post_id
    WHERE 1 - (pe.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY pe.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
