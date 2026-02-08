# Database Migrations

SQL migrations for the Supabase PostgreSQL database.

## How to Run

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the migration files in order:
   - `001_initial_schema.sql`
   - `002_llm_scoring_schema.sql`
   - `003_semantic_search.sql`
   - `004_background_jobs.sql`
   - `005_weight_config_versioning.sql`
   - `006_posts_with_scores_rpc.sql`
   - `007_has_scores_optimization.sql`
   - `008_job_cancellation.sql`
   - `009_job_retry.sql`
   - `010_neighborhood_filter.sql`
   - `011_reaction_count.sql`
   - `012_saved_posts.sql`
   - `013_rpc_saved_filter.sql`
   - `014_episode_date_filter.sql`
   - `015_fulltext_search.sql`

**Note:** The Python worker, web app settings/weight config flows, and TESTING_GUIDE assume migrations 004–009 are applied. Run all migrations for full functionality.

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
| `post_scores` | Final scores per post per weight config (versioned) |
| `weight_configs` | Named weight configurations and active flag |
| `background_jobs` | Long-running jobs (recompute scores, etc.) |
| `topic_frequencies` | Category counts for novelty scoring |
| `settings` | Application settings (active_weight_config_id, search_defaults, etc.) |

(Older tables such as `rankings` may exist from 001; post_scores/weight_configs supersede for versioned ranking.)

## Indexes

- `idx_posts_neighborhood` — Filter posts by neighborhood
- `idx_posts_hash` — Fast duplicate detection
- `idx_posts_created` — Sort by creation date
- `idx_embeddings_vector` — HNSW index for vector similarity search
- `idx_llm_scores_final` — Sort by final score
- `idx_llm_scores_categories` — GIN index for category filtering
- `idx_posts_unused` — Find unused posts
- `idx_background_jobs_type_status`, `idx_background_jobs_status`, `idx_background_jobs_created` — Job polling and listing

## RPC Functions

- `search_posts_by_embedding(query_embedding, similarity_threshold, result_limit)` — Semantic search using vector similarity
- `get_unscored_posts(limit)` — Get posts that need LLM scoring
- `get_posts_with_scores(weight_config_id, limit, offset, min_score, category, unused_only)` — Posts joined with scores for feed
- `get_posts_with_scores_count(weight_config_id, min_score, category, unused_only)` — Count for pagination
- `increment_topic_frequency(category, increment)` — Update topic frequency counts
- `recount_topic_frequencies()` — Recalculate all topic frequencies (call daily)
