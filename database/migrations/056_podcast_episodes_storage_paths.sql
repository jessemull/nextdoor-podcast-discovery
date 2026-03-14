-- Migration: Add storage path columns for private-bucket media
-- Run after 055_podcast_rpcs.sql.
--
-- audio_storage_path / image_storage_path hold the object key in the private
-- buckets. On publish, files are copied to public buckets and audio_url/image_url
-- are set. Draft episodes keep only paths; published get URLs after copy.

ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS audio_storage_path TEXT;
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS image_storage_path TEXT;
