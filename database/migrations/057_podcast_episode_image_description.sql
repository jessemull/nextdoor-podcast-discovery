-- Migration: Add image description for podcast episodes
-- Allows admin users to store alt/caption text for episode artwork.

ALTER TABLE podcast_episodes
ADD COLUMN IF NOT EXISTS image_description TEXT;

