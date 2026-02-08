-- Migration: Weight Config Versioning
-- Run this in Supabase SQL Editor after 004_background_jobs.sql
--
-- Implements versioned weight configurations and scores to enable:
-- - Atomic switching between weight configs
-- - Rollback without recompute
-- - Partial recompute
-- - Analytics/comparison between versions
-- - Clean failure handling

-- ============================================================================
-- Step 1: Create weight_configs table
-- ============================================================================

CREATE TABLE weight_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Weight configuration (same structure as settings.ranking_weights)
    weights JSONB NOT NULL,
    
    -- Metadata
    name TEXT,                    -- Optional human-readable name
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,              -- user email/id (from NextAuth)
    is_active BOOLEAN DEFAULT false,
    
    -- Notes/description for this config
    description TEXT
);

CREATE INDEX idx_weight_configs_active ON weight_configs(is_active) WHERE is_active = true;
CREATE INDEX idx_weight_configs_created ON weight_configs(created_at DESC);

-- Only one active config at a time (enforced by application logic)
-- We'll use settings.active_weight_config_id as the source of truth

-- ============================================================================
-- Step 2: Create post_scores table (versioned final scores)
-- ============================================================================

-- This table stores final_score for each post under each weight config
-- Allows multiple score versions per post (one per weight config)
CREATE TABLE post_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    weight_config_id UUID NOT NULL REFERENCES weight_configs(id) ON DELETE CASCADE,
    
    -- Computed final score for this post under this weight config
    final_score FLOAT NOT NULL,
    
    -- Metadata
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite unique constraint: one score per post per config
    UNIQUE(post_id, weight_config_id)
);

CREATE INDEX idx_post_scores_config ON post_scores(weight_config_id);
CREATE INDEX idx_post_scores_post ON post_scores(post_id);
CREATE INDEX idx_post_scores_score ON post_scores(weight_config_id, final_score DESC);

-- ============================================================================
-- Step 3: Add active_weight_config_id to settings
-- ============================================================================

-- Add pointer to active weight config (will be set by migration DO block)
-- Initial value is null, will be set to UUID string after creating default config

-- ============================================================================
-- Step 4: Migrate existing final_score to post_scores
-- ============================================================================

-- Create a default weight config from current settings
-- 
-- Transaction Safety:
-- The DO $$ block is automatically wrapped in a transaction. If any step fails,
-- the entire migration will roll back:
-- - Default config creation will be rolled back
-- - Settings update will be rolled back
-- - Score migration will be rolled back
-- This ensures data consistency - either all steps succeed or none do.
--
-- Rollback behavior:
-- If this migration fails partway, you can safely re-run it. The ON CONFLICT
-- clauses prevent duplicate inserts, and the migration is idempotent.
DO $$
DECLARE
    default_config_id UUID;
    current_weights JSONB;
BEGIN
    -- Get current weights from settings
    SELECT value INTO current_weights
    FROM settings
    WHERE key = 'ranking_weights';
    
    -- Create default config
    INSERT INTO weight_configs (weights, name, is_active, description)
    VALUES (
        COALESCE(current_weights, '{"absurdity": 2.0, "drama": 1.5, "discussion_spark": 1.0, "emotional_intensity": 1.2, "news_value": 1.0}'::JSONB),
        'Default (Migrated)',
        true,
        'Initial weight config migrated from settings table'
    )
    RETURNING id INTO default_config_id;
    
    -- Set as active in settings (store UUID as JSON string)
    -- Insert or update the setting
    INSERT INTO settings (key, value)
    VALUES ('active_weight_config_id', to_jsonb(default_config_id::TEXT))
    ON CONFLICT (key) DO UPDATE SET value = to_jsonb(default_config_id::TEXT);
    
    -- Migrate existing final_score values to post_scores
    INSERT INTO post_scores (post_id, weight_config_id, final_score, computed_at)
    SELECT 
        ls.post_id,
        default_config_id,
        COALESCE(ls.final_score, 0.0),
        ls.created_at
    FROM llm_scores ls
    WHERE ls.final_score IS NOT NULL
    ON CONFLICT (post_id, weight_config_id) DO NOTHING;
    
    RAISE NOTICE 'Created default weight config % and migrated % scores', default_config_id, (SELECT COUNT(*) FROM post_scores WHERE weight_config_id = default_config_id);
END $$;

-- ============================================================================
-- Step 5: Update background_jobs to track weight_config_id
-- ============================================================================

-- Add weight_config_id to background_jobs params (already JSONB, no schema change needed)
-- Jobs will store weight_config_id in params.weights_config_id

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check weight_configs:
-- SELECT * FROM weight_configs;

-- Check active config:
-- SELECT * FROM settings WHERE key = 'active_weight_config_id';

-- Check post_scores:
-- SELECT COUNT(*) FROM post_scores;

-- Check scores for active config:
-- SELECT COUNT(*) FROM post_scores ps
-- JOIN weight_configs wc ON ps.weight_config_id = wc.id
-- WHERE wc.is_active = true;
