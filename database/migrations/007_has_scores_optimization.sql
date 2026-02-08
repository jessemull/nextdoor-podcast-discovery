-- Migration: Optimize has_scores Check
-- Run this in Supabase SQL Editor after 006_posts_with_scores_rpc.sql
--
-- Adds a computed column to weight_configs to track whether a config has scores,
-- eliminating the need to query post_scores table on every API call.
--
-- This optimization improves performance of GET /api/admin/weight-configs
-- especially at scale (millions of post_scores).

-- ============================================================================
-- Step 1: Add has_scores column to weight_configs
-- ============================================================================

ALTER TABLE weight_configs
ADD COLUMN has_scores BOOLEAN DEFAULT false;

CREATE INDEX idx_weight_configs_has_scores ON weight_configs(has_scores) WHERE has_scores = true;

-- ============================================================================
-- Step 2: Update existing configs
-- ============================================================================

-- Set has_scores = true for configs that have post_scores
UPDATE weight_configs wc
SET has_scores = true
WHERE EXISTS (
    SELECT 1
    FROM post_scores ps
    WHERE ps.weight_config_id = wc.id
);

-- ============================================================================
-- Step 3: Create trigger to maintain has_scores
-- ============================================================================

-- Function to update has_scores when post_scores change
CREATE OR REPLACE FUNCTION update_weight_config_has_scores()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Mark config as having scores
        UPDATE weight_configs
        SET has_scores = true
        WHERE id = NEW.weight_config_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if config still has scores
        UPDATE weight_configs
        SET has_scores = EXISTS (
            SELECT 1
            FROM post_scores ps
            WHERE ps.weight_config_id = OLD.weight_config_id
        )
        WHERE id = OLD.weight_config_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on post_scores insert
CREATE TRIGGER trigger_update_has_scores_on_insert
    AFTER INSERT ON post_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_weight_config_has_scores();

-- Trigger on post_scores delete
CREATE TRIGGER trigger_update_has_scores_on_delete
    AFTER DELETE ON post_scores
    FOR EACH ROW
    EXECUTE FUNCTION update_weight_config_has_scores();

-- ============================================================================
-- Verification queries (run these to check the migration worked)
-- ============================================================================

-- Check has_scores column exists:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'weight_configs' AND column_name = 'has_scores';

-- Check triggers exist:
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE event_object_table = 'post_scores' 
-- AND trigger_name LIKE '%has_scores%';

-- Check has_scores values:
-- SELECT id, name, has_scores FROM weight_configs;
