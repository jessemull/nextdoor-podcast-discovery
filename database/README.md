# Database Migrations

SQL migrations for the Supabase PostgreSQL database.

## How to Run

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration files in order:
   - `001_initial_schema.sql`
   - (future migrations...)

## Seed Data

After running migrations, optionally run seed data:
- `seeds/seed_neighborhoods.sql`

## Schema Overview

| Table | Purpose |
|-------|---------|
| `neighborhoods` | Configured neighborhoods to scrape |
| `sessions` | Encrypted Nextdoor session cookies |
| `posts` | Raw post data from Nextdoor |
| `llm_scores` | Claude analysis results (scores, tags, summary) |
| `post_embeddings` | OpenAI embedding vectors for semantic search |
| `rankings` | Calculated final scores, episode usage tracking |
| `settings` | Application settings (ranking weights, etc.) |

## Indexes

- `idx_posts_neighborhood` — Filter posts by neighborhood
- `idx_posts_hash` — Fast duplicate detection
- `idx_posts_created` — Sort by creation date
- `idx_embeddings_vector` — HNSW index for vector similarity search
- `idx_rankings_score` — Sort by final score
- `idx_rankings_unused` — Find unused posts sorted by score
