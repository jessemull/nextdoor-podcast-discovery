-- Migration: Update LLM scoring schema
-- Run this in Supabase SQL Editor after 001_initial_schema.sql
--
-- Changes:
-- 1. Update llm_scores to use JSONB scores and categories array
-- 2. Add topic_frequencies table for novelty tracking
-- 3. Add episode tracking columns to posts table
-- 4. Drop rankings table (merged into llm_scores and posts)
-- 5. Update default ranking weights

-- ============================================================================
-- Step 1: Update llm_scores table
-- ============================================================================

-- Drop the old llm_scores table and recreate with new schema
-- (We drop because the structure is significantly different)
DROP TABLE IF EXISTS llm_scores CASCADE;

CREATE TABLE llm_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    
    -- Individual dimension scores (1-10 scale)
    -- Example: {"absurdity": 8, "drama": 6, "news_value": 3, ...}
    scores JSONB NOT NULL,
    
    -- Topic categories for frequency tracking
    -- Example: ['wildlife', 'humor', 'drama']
    categories TEXT[] NOT NULL DEFAULT '{}',
    
    -- Short summary for quick reference
    summary TEXT,
    
    -- Computed final score (weighted + novelty adjusted)
    final_score FLOAT,
    
    -- Metadata
    model_version TEXT DEFAULT 'claude-3-haiku-20240307',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_scores_post ON llm_scores(post_id);
CREATE INDEX idx_llm_scores_final ON llm_scores(final_score DESC);
CREATE INDEX idx_llm_scores_categories ON llm_scores USING GIN(categories);

-- ============================================================================
-- Step 2: Create topic_frequencies table
-- ============================================================================

CREATE TABLE topic_frequencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL UNIQUE,
    count_30d INT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with initial categories
INSERT INTO topic_frequencies (category, count_30d) VALUES
    ('crime', 0),
    ('drama', 0),
    ('humor', 0),
    ('local_news', 0),
    ('lost_pet', 0),
    ('noise', 0),
    ('suspicious', 0),
    ('wildlife', 0);

-- RPC function to atomically increment topic frequency
CREATE OR REPLACE FUNCTION increment_topic_frequency(p_category TEXT, p_increment INT)
RETURNS VOID AS $$
BEGIN
    UPDATE topic_frequencies 
    SET count_30d = count_30d + p_increment,
        last_updated = NOW()
    WHERE category = p_category;
    
    -- Insert if category doesn't exist
    IF NOT FOUND THEN
        INSERT INTO topic_frequencies (category, count_30d, last_updated)
        VALUES (p_category, p_increment, NOW())
        ON CONFLICT (category) DO UPDATE 
        SET count_30d = topic_frequencies.count_30d + p_increment,
            last_updated = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- RPC function to reset and recount topic frequencies (call daily via cron)
-- This is the safe approach - always accurate, no double-counting issues
CREATE OR REPLACE FUNCTION recount_topic_frequencies()
RETURNS VOID AS $$
BEGIN
    -- Reset all counts
    UPDATE topic_frequencies SET count_30d = 0, last_updated = NOW();
    
    -- Recount from llm_scores within last 30 days
    WITH recent_counts AS (
        SELECT unnest(categories) AS cat, COUNT(*) AS cnt
        FROM llm_scores
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY cat
    )
    UPDATE topic_frequencies tf
    SET count_30d = rc.cnt::INT,
        last_updated = NOW()
    FROM recent_counts rc
    WHERE tf.category = rc.cat;
END;
$$ LANGUAGE plpgsql;

-- RPC function to get unscored posts (oldest first for chronological processing)
CREATE OR REPLACE FUNCTION get_unscored_posts(p_limit INT DEFAULT 100)
RETURNS TABLE(id UUID, text TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.text
    FROM posts p
    LEFT JOIN llm_scores ls ON p.id = ls.post_id
    WHERE ls.id IS NULL
    ORDER BY p.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 3: Add episode tracking to posts table
-- ============================================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS used_on_episode BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS episode_date DATE;

-- Index for finding unused posts
CREATE INDEX IF NOT EXISTS idx_posts_unused 
    ON posts(used_on_episode) 
    WHERE used_on_episode = false;

-- ============================================================================
-- Step 4: Drop rankings table (no longer needed)
-- ============================================================================

DROP TABLE IF EXISTS rankings CASCADE;

-- ============================================================================
-- Step 5: Update default ranking weights
-- ============================================================================

-- Delete old weights and insert new ones
DELETE FROM settings WHERE key = 'ranking_weights';

INSERT INTO settings (key, value) VALUES 
    ('ranking_weights', '{
        "absurdity": 2.0,
        "drama": 1.5,
        "emotional_intensity": 1.2,
        "discussion_spark": 1.0,
        "news_value": 1.0
    }');

-- Also add novelty configuration
INSERT INTO settings (key, value) VALUES 
    ('novelty_config', '{
        "window_days": 30,
        "min_multiplier": 0.2,
        "max_multiplier": 1.5,
        "frequency_thresholds": {
            "rare": 5,
            "common": 30,
            "very_common": 100
        }
    }')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check llm_scores structure:
-- \d llm_scores

-- Check topic_frequencies:
-- SELECT * FROM topic_frequencies;

-- Check settings:
-- SELECT * FROM settings;
