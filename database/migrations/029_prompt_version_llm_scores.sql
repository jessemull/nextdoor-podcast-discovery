-- Add prompt_version to llm_scores for feedback loop and A/B tests

ALTER TABLE llm_scores
ADD COLUMN IF NOT EXISTS prompt_version TEXT;

COMMENT ON COLUMN llm_scores.prompt_version IS 'Version or hash of the scoring prompt that produced these scores';
