-- Migration: Podcast website schema (episodes, categories, embeddings)
-- Run in Supabase SQL Editor after 053.
--
-- Adds tables for the public podcast site: episodes, categories, many-to-many,
-- episode embeddings for related-episode similarity, and optional show settings.

-- Podcast episodes (CMS content for the public site)
CREATE TABLE podcast_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    show_notes TEXT,
    transcript TEXT,
    published_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    audio_url TEXT,
    image_url TEXT,
    duration_seconds INT,
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_podcast_episodes_slug ON podcast_episodes(slug);
CREATE INDEX idx_podcast_episodes_published_at ON podcast_episodes(published_at DESC NULLS LAST);
CREATE INDEX idx_podcast_episodes_status ON podcast_episodes(status);
CREATE INDEX idx_podcast_episodes_order_index ON podcast_episodes(order_index);

CREATE TRIGGER update_podcast_episodes_updated_at
    BEFORE UPDATE ON podcast_episodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Podcast categories (e.g. topic buckets for browse)
CREATE TABLE podcast_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_podcast_categories_slug ON podcast_categories(slug);

CREATE TRIGGER update_podcast_categories_updated_at
    BEFORE UPDATE ON podcast_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Episode <-> Category many-to-many
CREATE TABLE episode_categories (
    episode_id UUID NOT NULL REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES podcast_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (episode_id, category_id)
);

CREATE INDEX idx_episode_categories_episode ON episode_categories(episode_id);
CREATE INDEX idx_episode_categories_category ON episode_categories(category_id);

-- Episode embeddings for semantic similarity (related episodes)
CREATE TABLE episode_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    episode_id UUID NOT NULL UNIQUE REFERENCES podcast_episodes(id) ON DELETE CASCADE,
    embedding extensions.vector(1536),
    model TEXT DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_episode_embeddings_episode ON episode_embeddings(episode_id);
CREATE INDEX idx_episode_embeddings_vector ON episode_embeddings
    USING hnsw (embedding vector_cosine_ops);

-- Optional: show-level settings for RSS and SEO (can also use existing settings table)
CREATE TABLE podcast_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_podcast_settings_updated_at
    BEFORE UPDATE ON podcast_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
