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
   - `016_why_podcast_worthy.sql`
   - `017_posts_by_date_rpc.sql`
   - `018_embedding_backlog_count.sql`
   - `019_podcast_worthy_filter.sql`

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
- `get_unscored_posts(p_limit)` — Get posts that need LLM scoring
- `get_posts_with_scores(p_weight_config_id, p_limit, p_offset, p_min_score, p_category, p_unused_only, p_neighborhood_id, p_saved_only, p_episode_date, p_min_podcast_worthy, p_order_by)` — Posts joined with scores for feed; `p_order_by` = 'score' or 'podcast_worthy'; returns `why_podcast_worthy` (migrations 016, 019)
- `get_posts_with_scores_count(p_weight_config_id, p_min_score, p_category, p_unused_only, p_neighborhood_id, p_saved_only, p_episode_date, p_min_podcast_worthy)` — Count for score-sorted feed pagination (migration 019)
- `get_posts_by_date(p_limit, p_offset, p_category, p_min_score, p_neighborhood_id, p_saved_only, p_episode_date, p_unused_only, p_min_podcast_worthy)` — Posts by date with filters in DB (migrations 017, 019)
- `get_posts_by_date_count(p_category, p_min_score, p_neighborhood_id, p_saved_only, p_episode_date, p_unused_only, p_min_podcast_worthy)` — Count for date-sorted feed pagination (migration 019)
- `get_embedding_backlog_count()` — Count of posts with LLM scores but no embedding (migration 018)
- `increment_topic_frequency(p_category, p_increment)` — Update topic frequency counts
- `recount_topic_frequencies()` — Recalculate all topic frequencies (call daily)
