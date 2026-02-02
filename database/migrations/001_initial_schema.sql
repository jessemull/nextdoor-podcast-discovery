-- Initial database schema for Nextdoor Podcast Discovery Platform
-- Run this in Supabase SQL Editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Neighborhoods table
CREATE TABLE neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    weight_modifier FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (for storing encrypted Nextdoor cookies)
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID REFERENCES neighborhoods(id),
    cookies_encrypted TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    post_id_ext VARCHAR(255) NOT NULL,
    user_id_hash VARCHAR(64),
    text TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL,
    url VARCHAR(512),
    image_urls JSONB DEFAULT '[]',
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(neighborhood_id, hash)
);

CREATE INDEX idx_posts_neighborhood ON posts(neighborhood_id);
CREATE INDEX idx_posts_hash ON posts(hash);
CREATE INDEX idx_posts_created ON posts(created_at DESC);

-- LLM scores table
CREATE TABLE llm_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    absurdity FLOAT CHECK (absurdity >= 0 AND absurdity <= 10),
    humor FLOAT CHECK (humor >= 0 AND humor <= 10),
    drama FLOAT CHECK (drama >= 0 AND drama <= 10),
    relatability FLOAT CHECK (relatability >= 0 AND relatability <= 10),
    podcast_score FLOAT,
    tags JSONB DEFAULT '[]',
    summary TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_scores_post ON llm_scores(post_id);

-- Post embeddings table
CREATE TABLE post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    embedding VECTOR(1536),
    model VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Use HNSW index for better performance
CREATE INDEX idx_embeddings_vector ON post_embeddings 
    USING hnsw (embedding vector_cosine_ops);

-- Rankings table
CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    final_score FLOAT NOT NULL DEFAULT 0,
    used_on_episode BOOLEAN DEFAULT false,
    episode_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rankings_score ON rankings(final_score DESC);
CREATE INDEX idx_rankings_unused ON rankings(used_on_episode, final_score DESC);

-- Settings table
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default ranking weights
INSERT INTO settings (key, value) VALUES 
    ('ranking_weights', '{"absurdity": 1.0, "humor": 1.0, "drama": 1.0, "relatability": 1.0}');
