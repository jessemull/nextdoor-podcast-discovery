-- Migration: Use extensions.vector in search_posts_by_embedding so RPC works after 045
-- Run after 046_post_embeddings_vector_type_explicit.sql.
--
-- PostgREST casts RPC args using the function's parameter types. After moving the
-- vector extension to the extensions schema, the unqualified VECTOR(1536) param
-- can be introspected as public.vector and cause "type public.vector does not exist"
-- when calling from the API. Recreate the function with extensions.vector(1536)
-- so the schema cache and RPC calls use the correct type.

DROP FUNCTION IF EXISTS search_posts_by_embedding(vector, double precision, integer);

CREATE OR REPLACE FUNCTION search_posts_by_embedding(
    query_embedding extensions.vector(1536),
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
    SET search_path = public, extensions;
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
        AND COALESCE(p.ignored, false) = false
    ORDER BY pe.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION search_posts_by_embedding(extensions.vector(1536), double precision, integer)
  SET search_path = public, extensions;

NOTIFY pgrst, 'reload schema';
