# Podcast Post Discovery Platform — Project Plan

> Complete technical plan for the Nextdoor post discovery system.
> 
> **Cost Target**: ~$1–$5/month using free tiers and cost-optimized services.

---

## Table of Contents

1. [System Overview](#1-system-overview)
   - [1.1 How Nextdoor Feed Works](#11-how-nextdoor-feed-works)
   - [1.2 Scraping Strategy](#12-scraping-strategy)
   - [1.3 LLM Scoring Strategy](#13-llm-scoring-strategy)
2. [Architecture Layers](#2-architecture-layers)
3. [Technology Stack](#3-technology-stack)
4. [Cost Breakdown](#4-cost-breakdown)
5. [Repository Structure](#5-repository-structure)
6. [Data Flow](#6-data-flow)
7. [Database Schema](#7-database-schema)
8. [Component Specifications](#8-component-specifications)
9. [Special Features](#9-special-features)
10. [Infrastructure](#10-infrastructure)
11. [Security & Authentication](#11-security--authentication)
12. [Error Handling & Monitoring](#12-error-handling--monitoring)
13. [Development Setup](#13-development-setup)
14. [Deployment Pipeline](#14-deployment-pipeline)
15. [Design Decisions](#15-design-decisions)
16. [Implementation Checklist](#16-implementation-checklist)

---

## 1. System Overview

A platform that automatically discovers, analyzes, and curates interesting Nextdoor posts for podcast content.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Automated Scraping** | Twice-daily collection from Recent + Trending feeds (~500 posts/day) |
| **LLM Analysis** | Score posts on 5 dimensions (absurdity, drama, news value, discussion spark, emotional intensity) with topic categorization and novelty adjustment |
| **Semantic Search** | Find related posts by meaning, not just keywords (OpenAI embeddings + pgvector) |
| **Curation Dashboard** | Private web UI for browsing, filtering, and selecting posts |
| **Episode Tracking** | Mark posts as used, prevent duplicates |
| **Pittsburgh Sports Facts** | Random facts for Matt on each login (powered by Claude Haiku) |

---

## 1.1 How Nextdoor Feed Works

### Feed Tabs

Nextdoor's news feed has 4 tabs (discovered via DOM inspection):

| Tab | URL Pattern | Content Type | Value for Podcast |
|-----|-------------|--------------|-------------------|
| **For You** | `/news_feed/` (default) | Algorithmic recommendations | Mixed quality, personalized |
| **Recent** | `/news_feed/?ordering=recent` | Chronological, newest first | Fresh content, high volume |
| **Nearby** | `/news_feed/?ordering=nearby` | Proximity-based | Location-specific |
| **Trending** | `/news_feed/?ordering=trending` | High-engagement posts | **Best for absurd/viral content** |

### Why We Scrape Both Recent AND Trending

| Feed | Pros | Cons |
|------|------|------|
| **Recent** | Fresh content, comprehensive coverage | Lots of mundane posts |
| **Trending** | High-engagement, often dramatic/absurd | May miss new gems |

**Our Strategy**: Scrape both to maximize coverage. Deduplication prevents double-counting.

### Feed Behavior

- **Infinite Scroll**: Posts load dynamically as you scroll down
- **No Pagination**: Must scroll to load more content
- **Mobile-Optimized**: We use iPhone user agent for cleaner DOM
- **Rate Limiting**: Human-like delays prevent detection (2-5s between scrolls)

---

## 1.2 Scraping Strategy

### Daily Scraping (Production)

We run **two cron jobs** at different times to capture both feed types:

| Job | Schedule (UTC) | Feed | Posts | Purpose |
|-----|----------------|------|-------|---------|
| **Morning Scrape** | 6:00 AM | Recent | 250 | Catch overnight posts |
| **Evening Scrape** | 6:00 PM | Trending | 250 | Catch viral/engaging content |

**Target**: ~500 posts/day (with ~10-20% overlap after deduplication)

### Deduplication

Posts are deduplicated using SHA256 hash of normalized content:

```python
def generate_hash(text: str, author_id: str) -> str:
    """Generate unique hash for post deduplication."""
    normalized = text.strip().lower()
    content = f"{author_id}:{normalized}"
    return hashlib.sha256(content.encode()).hexdigest()
```

The `posts` table has a unique constraint on `(neighborhood_id, hash)` so duplicates are rejected at the database level.

### Backfill Strategy (Optional)

For initial data population, we can run manual backfill jobs:

```bash
# Run with higher post count to gather historical data
python -m src.main --feed-type recent --max-posts 500
python -m src.main --feed-type trending --max-posts 500
```

Each run scrolls deeper into the feed, capturing older posts. Run a few times manually before enabling scheduled jobs to build initial corpus.

### Bot Detection Mitigation

| Technique | Implementation |
|-----------|----------------|
| Human-like typing | Random delays 50-150ms per character |
| Scroll delays | Random 2-5 seconds between scrolls |
| Mobile user agent | iPhone iOS 17 Safari |
| Session reuse | Encrypted cookies stored in Supabase |
| Viewport | iPhone 14 Pro dimensions (375×812) |

### Known Limitations & TODOs

| Issue | Current Behavior | Future Improvement |
|-------|------------------|-------------------|
| **Stopping Logic** | Stops after 5 scrolls with no new unique posts | Add timestamp-based stopping (e.g., "stop at yesterday's posts") |
| **Post Links** | ✅ Extracted via Share modal (`--extract-permalinks` flag) | Done! |
| **Volume Uncertainty** | 250 is a cap, not a guarantee | Add metrics to track actual daily volume |

**Note**: The current stopping logic relies on in-memory deduplication during extraction. If all visible posts have been seen, it stops. This works but doesn't guarantee we've captured "all of today's posts" or any specific time range. Consider adding:
1. Timestamp parsing to stop at a specific cutoff (e.g., 24 hours ago)
2. Database dedup check to stop when encountering already-stored posts

---

## 1.3 LLM Scoring Strategy

### Goal

Identify posts that are **podcast-worthy** — not just funny, but interesting enough to discuss on air. This includes:

- **Absurd/Humorous**: Classic unhinged Nextdoor behavior, Karen complaints, ridiculous drama
- **Interesting/Newsworthy**: Something actually happened (fire, crime, unusual event)
- **Discussion-Worthy**: Posts that spark conversation, controversy, or debate

### Scoring Dimensions

Claude Haiku evaluates each post on 5 dimensions (1-10 scale):

| Dimension | Description | Example |
|-----------|-------------|---------|
| **Absurdity** | How ridiculous, unhinged, or "peak Nextdoor" is this? | Karen complaining about wind chimes at 2pm |
| **Drama** | Conflict, tension, heated exchanges | Neighbor feud over fence height |
| **News Value** | Something actually happened worth reporting | Fire, explosion, crime, accident |
| **Discussion Spark** | Would listeners want to talk about this? | Controversial local opinion |
| **Emotional Intensity** | Passion level in the writing | ALL CAPS, exclamation marks, strong language |

### The Novelty Problem

Frequent topics become boring. A coyote sighting might be interesting once, but not the 50th time.

**Solution**: Track topic frequency and apply a novelty multiplier.

```
┌─────────────────────────────────────────────────────────────┐
│  POST: "Saw a coyote on Elm Street this morning!"          │
│                                                              │
│  Base Score: 6/10 (mildly interesting wildlife)             │
│                                                              │
│  Frequency Check (last 30 days):                            │
│  - Coyote posts: 47                                         │
│  - Novelty Multiplier: 0.3x (very common topic)             │
│                                                              │
│  Final Score: 6 × 0.3 = 1.8 (probably skip)                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  POST: "MOUNTAIN LION in my backyard eating my cat!!!"      │
│                                                              │
│  Base Score: 9/10 (dramatic, unusual, newsworthy)           │
│                                                              │
│  Frequency Check (last 30 days):                            │
│  - Mountain lion posts: 0                                   │
│  - Novelty Multiplier: 1.5x (rare topic boost)              │
│                                                              │
│  Final Score: 9 × 1.5 = 13.5 (definitely include!)          │
└─────────────────────────────────────────────────────────────┘
```

### Topic Categories

Claude assigns one or more category tags to each post for frequency tracking:

| Category | Common (penalize over time) | Rare (boost) |
|----------|----------------------------|--------------|
| `wildlife` | Coyotes, squirrels, raccoons | Mountain lion, bear, exotic animals |
| `crime` | Package theft, car break-ins | Armed robbery, major incident |
| `noise` | Barking dogs, loud music | Explosions, gunfire |
| `lost_pet` | Standard lost cat/dog | Escaped exotic pet |
| `drama` | HOA complaints, parking disputes | Full-blown neighbor war |
| `local_news` | Road work, utility outage | Building collapse, major fire |
| `humor` | Unintentionally funny posts | Intentional community humor |
| `suspicious` | Generic "suspicious person" | Genuinely bizarre activity |

### Dimension Weights

Weights are configurable (stored in `settings` table). Default prioritizes humor/absurdity:

```python
DEFAULT_WEIGHTS = {
    "absurdity": 2.0,          # 2x weight — primary podcast focus
    "drama": 1.5,              # 1.5x — conflict is entertaining
    "emotional_intensity": 1.2, # Passion adds entertainment value
    "discussion_spark": 1.0,   # Baseline
    "news_value": 1.0,         # Baseline
}
```

### Final Score Calculation

```python
def calculate_final_score(scores: dict, weights: dict, novelty: float) -> float:
    """Calculate weighted score with novelty adjustment."""
    weighted_sum = sum(scores[dim] * weights[dim] for dim in scores)
    max_possible = sum(10 * w for w in weights.values())  # Normalize to 0-10
    normalized = (weighted_sum / max_possible) * 10
    return normalized * novelty
```

### Threshold Strategy

We **won't set a threshold initially**. Instead:

1. **Phase 1 (Data Collection)**: Score all posts, store everything
2. **Phase 2 (Analysis)**: After 1-2 weeks, analyze score distribution
3. **Phase 3 (Tuning)**: Set threshold based on what "good" posts actually score

This prevents premature optimization before we have data.

### Extensibility

The system is designed to be flexible:

- **Add dimensions**: Just add new keys to the scores JSONB column
- **Adjust weights**: Update `settings` table, no code changes
- **Tune categories**: Add new topic categories as patterns emerge
- **Adjust frequency window**: Currently 30 days, configurable

---

### Global Weight Updates & Background Jobs

**Why Materialized `final_score` + Background Jobs + Versioning?**

At scale (millions of posts), we need fast queries. The only performant approach is:
- **Materialized `final_score`**: Store pre-calculated scores in the database with an index
- **Fast queries**: Simple `ORDER BY final_score DESC` with indexed column
- **Tradeoff**: Weight changes require full recompute (background job)

**Why Versioning is Essential:**

Without versioning, you get:
- **Half-baked rankings**: While recompute runs, some rows have new scores, some don't → inconsistent results
- **No rollback**: Can't easily undo a bad weight change without full recompute
- **Heavy UX**: Weight changes feel expensive → fewer experiments
- **Corrupted state on failure**: Partial updates are hard to detect/clean up

With versioning:
- **Atomic switch**: Old scores stay intact, new scores build in parallel, flip `active_weight_config_id` → instant clean switch
- **Safe rollback**: Just point back to previous config, zero recompute
- **Decoupled compute**: Weight change is cheap (insert row), compute can run async/throttled/partial
- **Analytics**: Compare rankings between versions, A/B test weight configs
- **Clean failures**: Incomplete versions are invisible, cleanup is trivial

**Alternative approaches don't scale:**
- Dynamic calculation in API: Would require calculating scores for all posts on every query
- PostgreSQL functions: Can't use indexes on calculated values, slow at scale
- Hybrid approaches: Still require materialization for performance

**The architecture:**
- `weight_configs` table: Stores different weight configurations (versioned)
- `post_scores` table: Stores `final_score` per post per weight config (allows multiple versions)
- `settings.active_weight_config_id`: Points to active config (atomic switch)
- Background jobs compute scores for a specific config version
- Queries use active config's scores (fast, indexed)

Changing the **global** ranking weights should be:

- **Initiated from the UI** (settings page)
- **Executed as a background job** (on the scraper machine)
- **Observable** (with status + history in the database)
- **Queueable** (multiple jobs can queue, processed one at a time)

#### Background Job Model

We introduce a generic `background_jobs` table in Supabase:

```sql
CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,            -- e.g. 'recompute_final_scores'
    status TEXT NOT NULL,          -- 'pending' | 'running' | 'completed' | 'error' | 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by TEXT,               -- user email/id (from NextAuth)
    params JSONB,                  -- e.g. { "weights": { ... } }
    progress INTEGER,              -- 0–100 or records processed
    total INTEGER,                 -- total records to process (optional)
    error_message TEXT             -- error details when status = 'error'
);
```

This table is reusable for:

- Final score recompute jobs
- Topic frequency recount jobs
- Future maintenance tasks (cleanup, migrations, etc.)

#### Flow: Changing Global Ranking Weights

1. **User adjusts sliders on the Settings page**  
   - Frontend shows current weights for:
     - absurdity
     - drama
     - discussion_spark
     - emotional_intensity
     - news_value

2. **User clicks "Save & Recompute Scores"**  
   - `POST /api/admin/recompute-scores` is called:
     - Validates that the user is an admin (email whitelist).
     - Creates a new `weight_configs` row with the new weights.
     - Inserts a new `background_jobs` row with `weight_config_id` in params:

```sql
INSERT INTO background_jobs (type, status, created_by, params)
VALUES (
  'recompute_final_scores',
  'pending',
  :user_email,
  :params_json      -- includes a snapshot of the new weights
)
RETURNING id;
```

3. **UI Feedback on Settings Page**  
   - The API returns `{ jobId }`.
   - Settings page shows:
     - "Recompute started (Job #XYZ). This may take a few minutes."
     - **Displays ALL jobs** (not just latest) with status, progress, timestamps
     - Polls `/api/admin/jobs?type=recompute_final_scores&limit=10` for all recent jobs
     - **Button behavior**: Only disabled when a job is `running` (not when `pending` in queue)
     - Users can queue multiple jobs; they'll process sequentially

4. **Background Worker (Python) Picks Up the Job**  
   - Runs on the same Linux laptop as the scraper.
   - Periodically looks for:

```sql
SELECT * FROM background_jobs
WHERE type = 'recompute_final_scores' AND status = 'pending'
ORDER BY created_at ASC
LIMIT 1;
```

   - **Processes jobs one at a time** (FIFO queue)
   - When it finds a job:
     - Sets `status = 'running'`, `started_at = NOW()`.
     - Reads `weight_config_id` from job params.
     - Loads weights from `weight_configs` table.
     - Pages through posts/llm_scores in batches:
       - Example: 500–1,000 posts per batch.
       - For each batch:
         - Load `scores` JSON and `categories` for each post.
         - Calculate `final_score` using weights + novelty.
         - `INSERT INTO post_scores (post_id, weight_config_id, final_score)` (upsert).
         - Update `progress` and `total` in `background_jobs`.
     - On success:
       - `status = 'completed'`, `completed_at = NOW()`.
       - **Optionally**: Set `is_active = true` for this config and update `settings.active_weight_config_id` (atomic switch).
     - On error:
       - `status = 'error'`, `error_message = <details>`.
       - Incomplete `post_scores` rows remain but are invisible (only active config is queried).

5. **User Visibility & History**  
   - Settings page shows:
     - **All jobs** (not just latest) in a scrollable list
     - Status: `Pending`, `Running (23%)`, `Completed`, or `Error`.
     - Timestamps for `created_at`, `started_at`, `completed_at`.
     - `created_by` (who triggered the job) and `error_message` if failed.
     - **Queue position** (if pending, show how many jobs ahead)
     - **Weight config name/description** for each job
   - Shows **all weight configs** with ability to:
     - View config details
     - Switch active config (instant, no recompute)
     - Compare rankings between configs
   - This serves as a **log of all global weight changes** and recomputes.
   - Users can see job history and understand the queue state.

6. **Atomic Switch (After Job Completes)**
   - When job completes, user can click "Activate" to switch to new config
   - Or: Auto-activate on completion (configurable)
   - Switch is instant: `UPDATE settings SET value = :new_config_id WHERE key = 'active_weight_config_id'`
   - Queries immediately use new scores (no downtime, no inconsistency)

#### Scaling Considerations

- **Per-record work is cheap**: recompute is just a handful of multiplies/adds.
- **Batching**:
  - 10,000 posts → 10–20 batches → ~1–3 seconds total.
  - 1,000,000 posts → 1,000–2,000 batches → a few minutes.
  - 10,000,000 posts → tens of minutes: treat as a nightly/low-traffic job.
- The job runs off the web request path; UI remains responsive.

#### Per-User / Per-Session Weights

Even with a global `final_score`, the UI can still support:

- **Interactive sliders** that compute a *view-only* score per post using the stored `scores` JSON.
- Sorting locally in the browser or via an API without touching `final_score`.

This gives:

- A simple, fast **default ranking** via `final_score`.
- Flexible **personal tuning** without any background job.

---

### Search Defaults (Semantic Search Threshold)

The semantic search experience should have a **configurable global default** that can be tuned from the Settings page and used by the `/search` UI on first load.

#### Storage: `search_defaults` in `settings`

We will store search-related defaults in the existing `settings` table as a JSON blob:

```sql
INSERT INTO settings (key, value) VALUES
  ('search_defaults', '{
    "similarity_threshold": 0.2
  }')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

Current fields (extensible over time):

- `similarity_threshold` (float, 0.0–1.0)  
  - Default: `0.2` (looser, better recall for broad queries like “animals”).

#### API Integration

- **GET /api/settings**
  - Returns both:
    - `ranking_weights`
    - `search_defaults`
  - Used by the Settings page and the Search page (for initial defaults).

- **PUT /api/settings**
  - Accepts a payload such as:

```json
{
  "ranking_weights": {
    "absurdity": 2.0,
    "drama": 1.5,
    "discussion_spark": 1.0,
    "emotional_intensity": 1.2,
    "news_value": 1.0
  },
  "search_defaults": {
    "similarity_threshold": 0.2
  }
}
```

  - Validates input ranges (e.g. `0.0 <= similarity_threshold <= 1.0`).
  - Persists both configs to `settings`.

#### Search Page Behavior

- On initial load of `/search`:
  - Fetch `search_defaults` from the server (or via `GET /api/settings`).
  - Initialize the `similarityThreshold` React state to `search_defaults.similarity_threshold` (fallback to `0.2` if missing).

- During a session:
  - The user can adjust a **Similarity Threshold** slider:
    - Range: `0.0`–`1.0` (step `0.1`).
    - Label: “lower = more results, higher = more precise”.
  - The slider value is sent as `similarity_threshold` in the `/api/search` request body.

- From Settings page:
  - Admin can set the **global default similarity threshold**.
  - Clicking “Save”:
    - Calls `PUT /api/settings` with updated `search_defaults`.
    - No background job is needed; this is a simple config change.

This gives:

- A tunable **global default** for semantic search behavior.
- Per-session control via the slider on the Search page.
- Clear separation between **global defaults** (Settings) and **per-user tweaks** (Search UI).

### Cost-Optimized Approach

This architecture prioritizes **free tiers** and **pay-per-use** services:

| Traditional Approach | Our Approach | Savings |
|---------------------|--------------|---------|
| EC2 ($15/mo) | Local Linux laptop (free) | $15/mo |
| RDS ($15/mo) | Supabase Free (free) | $15/mo |
| AWS Secrets Manager ($2/mo) | .env file (free) | $2/mo |
| CloudWatch ($5/mo) | Healthchecks.io (free) | $5/mo |
| Claude Sonnet (~$10/mo) | Claude Haiku (~$1/mo) | $9/mo |

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Next.js Web UI (Vercel Free Tier)                                │  │
│  │  • Authentication (NextAuth.js)                                   │  │
│  │  • Feed view with filters                                         │  │
│  │  • Semantic + keyword search                                      │  │
│  │  • Ranking weight sliders                                         │  │
│  │  • Episode tracking                                               │  │
│  │  • Pittsburgh sports facts for Matt 🏈                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Next.js API Routes (via Vercel)                                  │  │
│  │  • GET  /api/posts         → Filtered, ranked post list           │  │
│  │  • GET  /api/posts/:id     → Single post with related posts       │  │
│  │  • POST /api/posts/:id/use → Mark as used on episode              │  │
│  │  • GET  /api/search        → Keyword + semantic search            │  │
│  │  • GET  /api/neighborhoods → List configured neighborhoods        │  │
│  │  • PUT  /api/settings      → Update ranking weights               │  │
│  │  • GET  /api/sports-fact   → Random Pittsburgh sports fact        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  PROCESSING LAYER (Local Linux Laptop)                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Scheduled Workflow (Daily @ 2:00 AM UTC)                        │   │
│  │                                                                  │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐            │   │
│  │  │   Scraper   │ → │ LLM Scorer  │ → │  Embedder   │            │   │
│  │  │ (Playwright)│   │(Claude Haiku│   │  (OpenAI)   │            │   │
│  │  └─────────────┘   └─────────────┘   └─────────────┘            │   │
│  │                                                                  │   │
│  │  • Runs in GitHub-hosted runner (Ubuntu)                        │   │
│  │  • 2,000 free minutes/month (uses ~5 min/day = 150 min/month)   │   │
│  │  • Session cookies stored encrypted in Supabase                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA LAYER (Supabase Free Tier)                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL + pgvector (500MB storage)                            │  │
│  │  • posts              — Raw post data + permalinks + images       │  │
│  │  • llm_scores         — Claude scores (JSONB) + categories        │  │
│  │  • topic_frequencies  — 30-day category counts for novelty calc   │  │
│  │  • post_embeddings    — Vector representations (OpenAI)           │  │
│  │  • neighborhoods      — Neighborhood config                       │  │
│  │  • settings           — Ranking weights, preferences              │  │
│  │  • sessions           — Encrypted Nextdoor session cookies        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  GitHub Secrets                                                   │  │
│  │  • NEXTDOOR_EMAIL, NEXTDOOR_PASSWORD                              │  │
│  │  • ANTHROPIC_API_KEY                                              │  │
│  │  • OPENAI_API_KEY                                                 │  │
│  │  • SUPABASE_URL, SUPABASE_KEY                                     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Nextdoor       │  │  Claude Haiku   │  │  OpenAI Embeddings API  │  │
│  │  (via scraper)  │  │  (scoring +     │  │  (vector generation)    │  │
│  │                 │  │   sports facts) │  │  $0.02/1M tokens        │  │
│  │                 │  │  ~$0.25/1M in   │  │                         │  │
│  │                 │  │  ~$1.25/1M out  │  │                         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Component | Technology | Cost | Rationale |
|-----------|------------|------|-----------|
| Framework | Next.js 14+ (App Router) | Free | SSR, API routes, React ecosystem |
| Hosting | Vercel Hobby | Free | Generous free tier, easy deploys |
| Language | TypeScript | Free | Type safety, better DX |
| Styling | Tailwind CSS | Free | Rapid UI development |
| Auth | NextAuth.js | Free | Easy setup, Google OAuth |
| State | React Query (TanStack) | Free | Server state management |

### Backend / Processing

| Component | Technology | Cost | Rationale |
|-----------|------------|------|-----------|
| Scraper Runtime | Local Linux laptop | Free | Residential IP avoids bot detection |
| Scraper | Python 3.11+ / Playwright | Free | Best browser automation |
| LLM Scoring | Claude Haiku | ~$1/mo | 20x cheaper than Sonnet, still good |
| Embeddings | OpenAI `text-embedding-3-small` | ~$0.50/mo | Extremely cheap, high quality |

### Data

| Component | Technology | Cost | Rationale |
|-----------|------------|------|-----------|
| Database | Supabase Free Tier | Free | PostgreSQL + pgvector included |
| Storage Limit | 500MB | Free | Enough for ~50K posts with embeddings |
| Secrets | GitHub Secrets | Free | Secure, integrated with Actions |

### Service Comparison: Why These Choices

| Need | Alternatives Considered | Chosen | Why |
|------|------------------------|--------|-----|
| Database | RDS, PlanetScale, Neon | **Supabase** | pgvector included, generous free tier |
| Compute | EC2, Lambda, Railway | **Local Linux laptop** | Free, residential IP avoids bot detection |
| LLM | Claude Sonnet, GPT-4 | **Claude Haiku** | 20x cheaper, fast, good enough |
| Hosting | Amplify, Netlify, Railway | **Vercel** | Best Next.js support, free tier |

---

## 4. Cost Breakdown

### Monthly Costs (Estimated)

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| **Supabase** | Free | $0.00 | 500MB storage, 2GB bandwidth |
| **Vercel** | Hobby | $0.00 | 100GB bandwidth, serverless |
| **Local Laptop** | Linux | $0.00 | Electricity only, always on |
| **Healthchecks.io** | Free | $0.00 | 20 checks, cron monitoring |
| **Claude Haiku** | Pay-per-use | ~$0.50–$1.00 | ~500 posts + sports facts |
| **OpenAI Embeddings** | Pay-per-use | ~$0.10–$0.50 | ~500 posts × ~200 tokens |
| | | | |
| **Total** | | **~$1–$2/month** | API costs only |

### Cost Scaling

| Posts/Month | Claude Haiku | OpenAI Embeddings | Total |
|-------------|-------------|-------------------|-------|
| 100 | $0.10 | $0.02 | ~$0.12 |
| 500 | $0.50 | $0.10 | ~$0.60 |
| 1,000 | $1.00 | $0.20 | ~$1.20 |
| 5,000 | $5.00 | $1.00 | ~$6.00 |

### Free Tier Limits to Watch

| Service | Limit | What Happens |
|---------|-------|--------------|
| Supabase | 500MB storage | Need to upgrade ($25/mo) or clean old data |
| Supabase | 2GB bandwidth/mo | Paused project (rarely hit) |
| Vercel | 100GB bandwidth | Need to upgrade ($20/mo) |
| Local laptop | Always-on required | Get a UPS for power outages |

### Storage Estimate

```
Per post (average):
  - posts table:        ~600 bytes (includes URL, image_urls)
  - llm_scores:         ~300 bytes (JSONB scores + categories)
  - post_embeddings:    ~6KB (1536 floats × 4 bytes)
  - indexes:            ~1KB
  ─────────────────────────────
  Total per post:       ~8KB

topic_frequencies:      ~50 bytes × ~20 categories = ~1KB total (negligible)

500MB limit ÷ 8KB = ~62,500 posts

At 500 posts/day × 30 days = 15,000 posts/month
At this rate: ~4 years before hitting limit (plenty of time)
```

---

## 5. Repository Structure

We use a **monorepo** approach — everything in a single repository for simplicity.

### Why Monorepo?

| Benefit | Description |
|---------|-------------|
| **Single source of truth** | All code in one place |
| **Shared secrets** | One set of GitHub Secrets |
| **Coordinated changes** | Update scraper + web in one PR |
| **Simpler CI/CD** | Workflows can access everything |
| **Appropriate for scale** | Solo/small team project |

### Directory Structure

```
nextdoor/
│
├── .github/
│   └── workflows/
│       ├── scrape.yml              # Daily scraper workflow (scheduled)
│       └── deploy.yml              # Web deploy on push to main
│
├── scraper/                        # Python scraper + workers
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py                 # Entry point for GitHub Action
│   │   ├── scraper.py              # Main scraper orchestrator
│   │   ├── session_manager.py      # Cookie persistence via Supabase
│   │   ├── post_extractor.py       # DOM parsing logic
│   │   ├── llm_scorer.py           # Claude Haiku scoring
│   │   ├── embedder.py             # OpenAI embeddings
│   │   ├── ranker.py               # Calculate final scores
│   │   └── config.py               # Configuration constants
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_scraper.py
│   │   ├── test_extractor.py
│   │   └── fixtures/               # Test HTML samples
│   │       └── sample_feed.html
│   ├── pyproject.toml              # Python project metadata
│   ├── requirements.txt            # Python dependencies
│   └── README.md                   # Scraper-specific documentation
│
├── web/                            # Next.js frontend
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   │   └── route.ts
│   │   │   ├── posts/
│   │   │   │   ├── route.ts        # GET /api/posts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts    # GET /api/posts/:id
│   │   │   │       └── use/
│   │   │   │           └── route.ts # POST /api/posts/:id/use
│   │   │   ├── search/
│   │   │   │   └── route.ts        # GET /api/search
│   │   │   ├── settings/
│   │   │   │   └── route.ts        # PUT /api/settings
│   │   │   └── sports-fact/
│   │   │       └── route.ts        # GET /api/sports-fact (for Matt)
│   │   ├── post/[id]/
│   │   │   └── page.tsx            # Post detail page
│   │   ├── search/
│   │   │   └── page.tsx            # Search page
│   │   ├── settings/
│   │   │   └── page.tsx            # Settings page
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Main feed (home)
│   │   └── globals.css             # Global styles
│   ├── components/
│   │   ├── ui/                     # Base UI components (shadcn/ui style)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   └── slider.tsx
│   │   ├── PostCard.tsx            # Individual post display
│   │   ├── PostFeed.tsx            # List of posts
│   │   ├── SearchBar.tsx           # Search input
│   │   ├── RankingSliders.tsx      # Weight adjustment sliders
│   │   ├── TagFilter.tsx           # Filter by tags
│   │   ├── NeighborhoodFilter.tsx  # Filter by neighborhood
│   │   ├── Navbar.tsx              # Navigation bar
│   │   └── SportsFact.tsx          # Pittsburgh sports fact banner
│   ├── lib/
│   │   ├── supabase.ts             # Supabase client setup
│   │   ├── auth.ts                 # NextAuth configuration
│   │   ├── claude.ts               # Claude API helper
│   │   ├── utils.ts                # Utility functions
│   │   └── types.ts                # TypeScript type definitions
│   ├── public/
│   │   └── favicon.ico
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── next.config.js
│   ├── .env.example                # Example environment variables
│   └── README.md                   # Web-specific documentation
│
├── database/                       # Database management
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  # Create all tables
│   │   ├── 002_add_sessions.sql    # Sessions table
│   │   └── 003_add_indexes.sql     # Performance indexes
│   ├── seeds/
│   │   └── seed_neighborhoods.sql  # Initial neighborhood data
│   └── README.md                   # How to run migrations
│
├── scripts/                        # Utility scripts
│   ├── setup-local.sh              # Set up local dev environment
│   ├── generate-encryption-key.py  # Generate Fernet key
│   └── test-supabase-connection.py # Verify Supabase connection
│
├── .env.example                    # Root-level env example
├── .gitignore                      # Git ignore rules
├── docker-compose.yml              # Local Postgres for development
├── Makefile                        # Common commands
├── PROJECT_PLAN.md                 # This document
└── README.md                       # Project overview and quick start
```

### File Responsibilities

#### `/scraper/src/`

| File | Responsibility |
|------|----------------|
| `main.py` | Entry point — orchestrates full pipeline |
| `scraper.py` | Playwright browser automation |
| `session_manager.py` | Load/save encrypted cookies to Supabase |
| `post_extractor.py` | Parse Nextdoor DOM, extract post data |
| `llm_scorer.py` | Call Claude Haiku, parse JSON scores |
| `embedder.py` | Call OpenAI, generate vectors |
| `ranker.py` | Calculate `final_score` from weights |
| `config.py` | Configuration constants |

#### `/web/app/`

| Path | Responsibility |
|------|----------------|
| `page.tsx` | Main feed — ranked posts list |
| `search/page.tsx` | Semantic + keyword search |
| `post/[id]/page.tsx` | Post detail with related posts |
| `settings/page.tsx` | Ranking weight configuration |
| `api/` | All API routes (server-side) |

#### `/database/migrations/`

Numbered SQL files, run in order:
```
001_initial_schema.sql    → Create core tables
002_add_sessions.sql      → Add sessions table
003_add_indexes.sql       → Performance indexes
```

### Workflow Connections

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐         ┌─────────────┐                      │
│   │  /scraper   │         │   /web      │                      │
│   │  (Python)   │         │  (Next.js)  │                      │
│   └──────┬──────┘         └──────┬──────┘                      │
│          │                       │                              │
│   ┌──────▼──────┐         ┌──────▼──────┐                      │
│   │  scrape.yml │         │  deploy.yml │                      │
│   │  (daily)    │         │  (on push)  │                      │
│   └──────┬──────┘         └──────┬──────┘                      │
│          │                       │                              │
└──────────│───────────────────────│──────────────────────────────┘
           │                       │
           ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │  Supabase   │◄────────│   Vercel    │
    │  (data)     │         │  (hosting)  │
    └─────────────┘         └─────────────┘
```

---

## 6. Data Flow

### Dual-Feed Pipeline (Local Cron Jobs)

We run **two separate scraping cron jobs** plus **one embedding job** to capture different types of content:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW 1: RECENT FEED @ 8:00 AM LOCAL                                │
│  ────────────────────────────────────────────────────────────────────── │
│  Feed: Recent (chronological)                                           │
│  Target: 250 posts                                                      │
│  Purpose: Catch fresh overnight content                                 │
│  Actions: Scrape → Store → Score                                        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW 2: TRENDING FEED @ 2:00 PM LOCAL                              │
│  ────────────────────────────────────────────────────────────────────── │
│  Feed: Trending (high-engagement)                                       │
│  Target: 250 posts                                                      │
│  Purpose: Catch viral/absurd/dramatic posts                             │
│  Actions: Scrape → Store → Score                                        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW 3: EMBEDDINGS @ 10:00 PM LOCAL                                │
│  ────────────────────────────────────────────────────────────────────── │
│  Purpose: Generate embeddings for semantic search                        │
│  Target: All posts without embeddings                                   │
│  Actions: Generate → Store (skips posts that already have embeddings)   │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pipeline Steps (Each Run)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SCRAPE JOB (~3 minutes)                                                │
│  ────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  STEP 1: SCRAPE                                                    │  │
│  │  ──────────────────────────────────────────────────────────────── │  │
│  │  1. Install Playwright + Chromium                                 │  │
│  │  2. Load session cookies from Supabase (or login fresh)           │  │
│  │  3. Navigate to feed (Recent or Trending based on --feed-type)    │  │
│  │  4. Scroll and extract posts:                                     │  │
│  │     a. Parse post container for text, author, timestamp, images   │  │
│  │     b. Compute SHA256 hash of content                             │  │
│  │     c. Skip if hash exists in DB (dedup)                          │  │
│  │     d. Insert new posts into Supabase                             │  │
│  │  5. Stop when reaching max_posts (250) or no new content          │  │
│  │  6. Save updated session cookies to Supabase                      │  │
│  │  7. Output: Count of new posts inserted                           │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  JOB 2: ANALYZE (~1 minute)                                        │  │
│  │  ──────────────────────────────────────────────────────────────── │  │
│  │  1. Query posts without LLM scores                                │  │
│  │  2. Batch posts (5-10 per request)                                │  │
│  │  3. Send to Claude Haiku with scoring prompt                      │  │
│  │  4. Parse JSON response                                           │  │
│  │  5. Insert scores, tags, summary into llm_scores                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  JOB 3: EMBED (~30 seconds)                                        │  │
│  │  ──────────────────────────────────────────────────────────────── │  │
│  │  1. Query posts without embeddings                                │  │
│  │  2. Batch texts (up to 100 per request)                           │  │
│  │  3. Call OpenAI embeddings API                                    │  │
│  │  4. Store vectors in post_embeddings                              │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│                                    ▼                                     │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  JOB 4: RANK (~10 seconds)                                         │  │
│  │  ──────────────────────────────────────────────────────────────── │  │
│  │  1. Load ranking weights from settings                            │  │
│  │  2. Calculate: final_score = Σ(score × weight)                    │  │
│  │  3. Store final_score in llm_scores table                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Total runtime: ~5 minutes                                              │
│  Monthly usage: ~150 minutes (well under 2,000 free minutes)            │
└──────────────────────────────────────────────────────────────────────────┘
```

### On-Demand (Web UI)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  USER REQUESTS (via Next.js API Routes on Vercel)                       │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  GET /api/posts                                                          │
│  └── Query: JOIN posts + llm_scores                                     │
│      └── Filter: neighborhood, categories, used_on_episode              │
│      └── Order: final_score DESC                                        │
│      └── Paginate: offset/limit                                         │
│                                                                          │
│  GET /api/search?q=...                                                   │
│  └── If semantic: Generate embedding → vector similarity search         │
│  └── If keyword: Full-text search with ts_vector                        │
│                                                                          │
│  GET /api/posts/:id                                                      │
│  └── Fetch post + scores                                                │
│  └── Find related: Vector similarity top 5                              │
│                                                                          │
│  POST /api/posts/:id/use                                                 │
│  └── Update: posts.used_on_episode = true                               │
│  └── Update: posts.episode_date = NOW()                                 │
│                                                                          │
│  PUT /api/settings                                                       │
│  └── Update ranking weights                                             │
│  └── Trigger re-rank (or lazy re-rank on next fetch)                    │
│                                                                          │
│  GET /api/sports-fact (for Matt only)                                    │
│  └── Call Claude Haiku for random Pittsburgh sports fact                │
│  └── Return fact as JSON                                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  neighborhoods  │       │     posts       │       │   llm_scores    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id          PK  │◄──┐   │ id          PK  │◄──────│ id          PK  │
│ name            │   │   │ neighborhood_id │───────│ post_id     FK  │
│ slug            │   └───│ post_id_ext     │       │ scores      JSON│
│ is_active       │       │ user_id_hash    │       │ categories  []  │
│ weight_modifier │       │ text            │       │ summary         │
│ created_at      │       │ hash            │       │ final_score     │
│ updated_at      │       │ url             │       │ model_version   │
└─────────────────┘       │ image_urls      │       │ created_at      │
                          │ posted_at       │       └─────────────────┘
┌─────────────────┐       │ created_at      │
│    sessions     │       └─────────────────┘       ┌─────────────────┐
├─────────────────┤                │                │topic_frequencies│
│ id          PK  │ ┌──────────────┼────────────┐   ├─────────────────┤
│ neighborhood_id │ │              │            │   │ id          PK  │
│ cookies_enc     │ ▼              ▼            │   │ category        │
│ expires_at      │ ┌─────────────────┐ ┌───────┴───┤ count_30d       │
│ updated_at      │ │ post_embeddings │ │  settings │ │ last_updated    │
└─────────────────┘ ├─────────────────┤ ├───────────┤ └─────────────────┘
                    │ id          PK  │ │ id     PK │
                    │ post_id     FK  │ │ key       │
                    │ embedding VECTOR│ │ value JSON│
                    │ model           │ │ updated_at│
                    │ created_at      │ └───────────┘
                                        └─────────────────┘
```

### Table Definitions

#### `neighborhoods`

```sql
CREATE TABLE neighborhoods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    weight_modifier FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `sessions` (for storing Nextdoor cookies)

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID REFERENCES neighborhoods(id),
    cookies_encrypted TEXT NOT NULL,          -- AES-256 encrypted JSON
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `posts`

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    post_id_ext VARCHAR(255) NOT NULL,        -- Nextdoor's post ID
    user_id_hash VARCHAR(64),                  -- SHA256 of user ID (anonymized)
    text TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL,                 -- SHA256 of text for dedup
    url VARCHAR(512),
    image_urls JSONB DEFAULT '[]',
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(neighborhood_id, hash)              -- Prevent duplicates per neighborhood
);

CREATE INDEX idx_posts_neighborhood ON posts(neighborhood_id);
CREATE INDEX idx_posts_hash ON posts(hash);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
```

#### `llm_scores`

Stores Claude Haiku's analysis of each post. Scores are stored as JSONB for flexibility (easy to add new dimensions later).

```sql
CREATE TABLE llm_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    
    -- Individual dimension scores (1-10 scale)
    -- Stored as JSONB for flexibility: {"absurdity": 8, "drama": 6, ...}
    scores JSONB NOT NULL,
    
    -- Topic categories for frequency tracking: ['wildlife', 'humor', 'drama']
    categories TEXT[] NOT NULL DEFAULT '{}',
    
    -- Short summary for quick reference
    summary TEXT,
    
    -- Computed final score (weighted + novelty adjusted)
    final_score FLOAT,
    
    -- Metadata
    model_version TEXT DEFAULT 'claude-3-haiku-20240307',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_scores_post ON llm_scores(post_id);
CREATE INDEX idx_llm_scores_final ON llm_scores(final_score DESC);
CREATE INDEX idx_llm_scores_categories ON llm_scores USING GIN(categories);
```

#### `topic_frequencies`

Tracks how often each topic category appears (global, 30-day rolling window). Used to calculate novelty multiplier.

```sql
CREATE TABLE topic_frequencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL UNIQUE,
    count_30d INT DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- Example data:
-- | category   | count_30d | last_updated |
-- |------------|-----------|--------------|
-- | wildlife   | 127       | 2024-01-15   |
-- | lost_pet   | 89        | 2024-01-15   |
-- | crime      | 45        | 2024-01-15   |
```

#### `post_embeddings`

```sql
-- pgvector is pre-installed on Supabase
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    embedding VECTOR(1536),                    -- OpenAI text-embedding-3-small dimension
    model VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Use HNSW index for better performance (Supabase supports this)
CREATE INDEX idx_embeddings_vector ON post_embeddings 
    USING hnsw (embedding vector_cosine_ops);
```

#### Episode Tracking (in `posts` table)

Episode usage is tracked directly in the `posts` table:

```sql
-- Add these columns to posts table
ALTER TABLE posts ADD COLUMN used_on_episode BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN episode_date DATE;

CREATE INDEX idx_posts_unused ON posts(used_on_episode) WHERE used_on_episode = false;
```

**Note**: We removed the separate `rankings` table. Final scores are stored in `llm_scores.final_score`, and episode tracking is in `posts`.

#### `settings`

```sql
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default ranking weights
INSERT INTO settings (key, value) VALUES 
    ('ranking_weights', '{"absurdity": 1.0, "humor": 1.0, "drama": 1.0, "relatability": 1.0}');
```

---

## 8. Component Specifications

### 8.1 Scraper (Local Linux Laptop)

**Location**: `/scraper/`

**Runs on**: Dedicated Linux laptop in basement (cron jobs)

**Key Files**:

```
/scraper/
├── src/
│   ├── __init__.py
│   ├── main.py                    # Entry point for GitHub Action
│   ├── session_manager.py         # Cookie persistence via Supabase
│   ├── post_extractor.py          # DOM parsing logic
│   ├── scraper.py                 # Main orchestrator
│   └── config.py                  # Configuration
└── requirements.txt
```

**Session Manager** (stores cookies in Supabase):

```python
# scraper/src/session_manager.py
import os
from cryptography.fernet import Fernet
from supabase import create_client

class SessionManager:
    """Manages Nextdoor login sessions stored in Supabase."""
    
    def __init__(self):
        self.supabase = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"]
        )
        self.cipher = Fernet(os.environ["SESSION_ENCRYPTION_KEY"])
    
    def get_cookies(self, neighborhood_id: str) -> list[dict] | None:
        """Load and decrypt session cookies from Supabase."""
        result = self.supabase.table("sessions") \
            .select("cookies_encrypted, expires_at") \
            .eq("neighborhood_id", neighborhood_id) \
            .single() \
            .execute()
        
        if not result.data:
            return None
        
        # Check expiration
        if result.data["expires_at"] < datetime.now().isoformat():
            return None
        
        # Decrypt cookies
        encrypted = result.data["cookies_encrypted"].encode()
        decrypted = self.cipher.decrypt(encrypted)
        return json.loads(decrypted)
    
    def save_cookies(self, neighborhood_id: str, cookies: list[dict]) -> None:
        """Encrypt and save session cookies to Supabase."""
        encrypted = self.cipher.encrypt(json.dumps(cookies).encode())
        
        self.supabase.table("sessions").upsert({
            "neighborhood_id": neighborhood_id,
            "cookies_encrypted": encrypted.decode(),
            "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
            "updated_at": datetime.now().isoformat()
        }).execute()
```

**CLI Arguments**:

```bash
# Basic usage
python -m src.main                              # Default: recent feed, 250 posts

# Feed type selection
python -m src.main --feed-type recent           # Scrape Recent tab (chronological)
python -m src.main --feed-type trending         # Scrape Trending tab (high-engagement)

# Post limits
python -m src.main --max-posts 500              # Scrape up to 500 posts (for backfill)
python -m src.main --max-posts 100              # Quick test run

# Development flags
python -m src.main --dry-run                    # Don't save to database
python -m src.main --visible                    # Show browser (not headless)
python -m src.main --extract-permalinks         # Extract post URLs (slower)

# Combined example (backfill trending with permalinks)
python -m src.main --feed-type trending --max-posts 100 --extract-permalinks --visible
```

**Configuration** (in `scraper/src/config.py`):

```python
SCRAPER_CONFIG = {
    "headless": True,                    # Default: headless (cron jobs)
    "login_timeout_ms": 15000,           # Wait for login redirect
    "max_posts_per_run": 250,            # Default posts per scrape
    "navigation_timeout_ms": 10000,      # Page load timeout
    "scroll_delay_ms": (2000, 5000),     # Random delay between scrolls
    "typing_delay_ms": (50, 150),        # Human-like typing speed
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "viewport": {"width": 375, "height": 812},  # iPhone 14 Pro
}

# Feed URLs
FEED_URLS = {
    "recent": "https://nextdoor.com/news_feed/?ordering=recent",
    "trending": "https://nextdoor.com/news_feed/?ordering=trending",
}
```

### 8.2 LLM Scoring Worker

**Location**: `/scraper/src/llm_scorer.py`

**Model**: Claude Haiku (`claude-3-haiku-20240307`)

**Why Haiku over Sonnet?**
- 20x cheaper ($0.25 vs $3 per 1M input tokens)
- Faster response times
- Good enough for humor/absurdity scoring

**Prompt Template**:

```python
SCORING_PROMPT = """
Analyze this Nextdoor post and return JSON scores.

Post:
{post_text}

Return ONLY valid JSON:
{{
  "absurdity": <1-10>,
  "humor": <1-10>,
  "drama": <1-10>,
  "relatability": <1-10>,
  "podcast_worthiness": <1-10>,
  "tags": ["tag1", "tag2"],
  "summary": "<one line>"
}}

Scoring:
- absurdity: How bizarre/unexpected?
- humor: How funny for a podcast?
- drama: Conflict level?
- relatability: "That's so true" factor?
- podcast_worthiness: Overall show potential?

Tags: lowercase, hyphenated (e.g., "lost-pet", "neighbor-feud").
"""
```

### 8.3 Embedding Worker

**Location**: `/scraper/src/embedder.py`

**Model**: OpenAI `text-embedding-3-small` (1536 dimensions)

```python
# scraper/src/embedder.py
from openai import OpenAI

client = OpenAI()  # Uses OPENAI_API_KEY env var

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for multiple texts in one API call."""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]
```

### 8.4 Web UI

**Location**: `/web/`

**Hosting**: Vercel (Free Tier)

**Key Components**:

```
/web/
├── app/                          # Next.js App Router
├── components/                   # React components
├── lib/                          # Utilities and clients
├── package.json
└── next.config.js
```

**Supabase Client**:

```typescript
// web/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// For server-side (API routes)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
```

---

## 9. Special Features

### 9.1 Pittsburgh Sports Facts for Matt

When Matt logs in, he sees a random interesting fact about Pittsburgh sports teams (Steelers, Pirates, Penguins).

#### How It Works

```
┌──────────────────────────────────────────────────────────────────────┐
│                     PITTSBURGH SPORTS FACT FLOW                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Matt logs in via Google OAuth                                   │
│     └── NextAuth identifies user by email                           │
│                                                                      │
│  2. Frontend checks if user is Matt                                 │
│     └── If yes, call GET /api/sports-fact                           │
│                                                                      │
│  3. API route calls Claude Haiku                                    │
│     └── "Give me a random interesting fact about Pittsburgh         │
│          sports (Steelers, Pirates, or Penguins)"                   │
│                                                                      │
│  4. Display fact in welcome banner                                  │
│     └── "Hey Matt! Did you know... [fact]"                          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

#### Implementation

**API Route** (`/web/app/api/sports-fact/route.ts`):

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const anthropic = new Anthropic();

// Matt's email (configure in env or hardcode)
const USER_EMAIL = process.env.USER_EMAIL || 'matt@example.com';

const SPORTS_FACT_PROMPT = `Give me one random, interesting, and lesser-known fact about Pittsburgh sports teams (Steelers, Pirates, or Penguins). 

Requirements:
- Pick a random team each time
- Make it surprising or amusing
- Keep it to 1-2 sentences
- Include the year if relevant
- Don't repeat common facts everyone knows

Return ONLY the fact, no preamble.`;

export async function GET() {
  // Verify user is Matt
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email || session.user.email !== USER_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: SPORTS_FACT_PROMPT
      }]
    });

    const fact = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    return Response.json({ fact });
  } catch (error) {
    console.error('Failed to generate sports fact:', error);
    return Response.json({ 
      fact: "The Steelers have won 6 Super Bowls, more than any other NFL team!" 
    });
  }
}
```

**Frontend Component** (`/web/components/SportsFact.tsx`):

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const USER_EMAIL = 'matt@example.com'; // Or from env

export function SportsFact() {
  const { data: session } = useSession();
  const [shouldFetch, setShouldFetch] = useState(false);

  // Only fetch for Matt
  useEffect(() => {
    if (session?.user?.email === USER_EMAIL) {
      setShouldFetch(true);
    }
  }, [session]);

  const { data, isLoading } = useQuery({
    queryKey: ['sports-fact'],
    queryFn: async () => {
      const res = await fetch('/api/sports-fact');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: shouldFetch,
    staleTime: Infinity, // Don't refetch during session
  });

  if (!shouldFetch || isLoading || !data?.fact) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-4 py-3 rounded-lg mb-6 shadow-md">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🏈</span>
        <div>
          <p className="font-bold">Hey Matt!</p>
          <p className="text-sm">{data.fact}</p>
        </div>
      </div>
    </div>
  );
}
```

**Usage in Layout**:

```tsx
// web/app/page.tsx
import { SportsFact } from '@/components/SportsFact';

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-8">
      <SportsFact />
      {/* Rest of the feed */}
    </main>
  );
}
```

#### Cost Impact

- Claude Haiku: ~100 tokens per request
- At $0.25/1M input + $1.25/1M output tokens
- ~$0.0001 per fact
- If Matt logs in 30 times/month = $0.003/month
- **Negligible cost impact**

#### Example Facts Claude Might Generate

- "In 1972, the Steelers' 'Immaculate Reception' was voted the greatest play in NFL history, but to this day, no one can agree if the ball actually touched a Raiders player first."
- "The Pittsburgh Pirates once had a parrot named 'Parrot' as their mascot from 1979-1985, who would ride around on a ATV during games."
- "Mario Lemieux came out of retirement in 2000 as both a player AND owner of the Penguins—the only person to ever do both simultaneously in NHL history."

---

## 10. Infrastructure

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LOCAL MACHINE (Linux Laptop)                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Scraper Runtime                                                  │  │
│  │  ├── Cron jobs (systemd timers or crontab)                       │  │
│  │  ├── Python 3.11+ with Playwright                                │  │
│  │  └── Environment variables (.env file)                           │  │
│  │                                                                   │  │
│  │  Schedule:                                                        │  │
│  │  ├── 6:00 AM local: Scrape Recent (250 posts)                   │  │
│  │  └── 6:00 PM local: Scrape Trending (250 posts)                 │  │
│  │                                                                   │  │
│  │  Monitoring: Healthchecks.io (free tier)                         │  │
│  │  └── Pings on success, alerts on failure                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
└──────────────────────────────│──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLOUD SERVICES                                 │
│                                                                          │
│  ┌─────────────────────────┐       ┌─────────────────────────┐          │
│  │       SUPABASE          │       │        VERCEL           │          │
│  │  (Free Tier)            │       │  (Hobby Tier)           │          │
│  │                         │       │                         │          │
│  │  PostgreSQL + pgvector  │◄──────│  Next.js App            │          │
│  │  • 500MB storage        │       │  • API Routes           │          │
│  │  • 2GB bandwidth        │       │  • SSR Pages            │          │
│  │  • Unlimited API calls  │       │  • Auth (NextAuth)      │          │
│  │                         │       │  • Sports Facts API     │          │
│  └─────────────────────────┘       └─────────────────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why Local Machine Instead of GitHub Actions?

| Approach | Pros | Cons |
|----------|------|------|
| **GitHub Actions** | Free, no hardware needed | Higher bot detection risk (datacenter IPs) |
| **Local Machine** ✅ | Residential IP (lower detection risk), full control | Requires always-on machine |

**Decision**: Run scraper on a dedicated Linux laptop in the basement to minimize bot detection risk. Nextdoor is more likely to flag requests from datacenter IPs (like GitHub Actions runners) than residential IPs.

### Infrastructure Components

| Component | Service | Cost |
|-----------|---------|------|
| Scraper Runtime | Local Linux laptop | $0 (electricity only) |
| Database | Supabase Free | $0 |
| Web Hosting | Vercel Hobby | $0 |
| Monitoring | Healthchecks.io Free | $0 |
| LLM Scoring | Claude Haiku | ~$1/mo |
| Embeddings | OpenAI | ~$0.50/mo |

---

## 11. Security & Authentication

### Web UI Authentication

Using NextAuth.js with Google OAuth + email whitelist:

```typescript
// web/lib/auth.ts
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const ALLOWED_EMAILS = [
  "your-email@example.com",
  "matt@example.com",  // Matt gets sports facts!
]

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email ?? "")
    },
  },
}
```

### Secrets Storage

All secrets in GitHub repository settings:

| Secret | Purpose |
|--------|---------|
| `NEXTDOOR_EMAIL` | Nextdoor login email |
| `NEXTDOOR_PASSWORD` | Nextdoor login password |
| `ANTHROPIC_API_KEY` | Claude API access |
| `OPENAI_API_KEY` | Embeddings API access |
| `SUPABASE_URL` | Database URL |
| `SUPABASE_KEY` | Database service key |
| `SESSION_ENCRYPTION_KEY` | Fernet key for cookie encryption |
| `GOOGLE_CLIENT_ID` | OAuth for web UI |
| `GOOGLE_CLIENT_SECRET` | OAuth for web UI |
| `NEXTAUTH_SECRET` | NextAuth session encryption |
| `USER_EMAIL` | Matt's email for sports facts |

### Data Privacy

| Data | Handling |
|------|----------|
| User IDs | Hashed (SHA256) before storage |
| Post content | Stored as-is (public posts) |
| Session cookies | Encrypted at rest |

---

## 12. Error Handling & Monitoring

### Retry Strategy

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
def call_claude_api(prompt: str) -> dict:
    # API call with automatic retry
    pass
```

### Custom Exceptions

```python
class ScraperError(Exception):
    """Base exception for scraper errors."""
    pass

class SessionExpiredError(ScraperError):
    """Nextdoor session has expired, need fresh login."""
    pass

class RateLimitError(ScraperError):
    """Hit rate limit, need to back off."""
    pass
```

### Healthchecks.io Notifications

```yaml
- name: Notify on failure
  if: failure()
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: '🚨 Scraper failed',
        body: `Workflow failed: ${context.workflow}\nRun: ${context.runId}`
      })
```

---

## 13. Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for local Postgres)
- Supabase account (free)

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd nextdoor

# Set up local database
docker-compose up -d

# Set up Python environment
cd scraper
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set up frontend
cd ../web
npm install

# Copy environment files
cp .env.example .env.local
# Edit .env.local with your keys
```

### Docker Compose (Local Dev)

```yaml
# docker-compose.yml
version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: nextdoor
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: nextdoor
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d

volumes:
  pgdata:
```

### Makefile

```makefile
.PHONY: dev db-up db-down test

db-up:
	docker-compose up -d

db-down:
	docker-compose down

dev-scraper:
	cd scraper && python -m src.main --dry-run

dev-web:
	cd web && npm run dev

test:
	cd scraper && pytest
	cd web && npm test

gen-key:
	python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

## 14. Deployment Pipeline

### Local Scraper (Linux Laptop)

We run the scraper on a dedicated Linux laptop in the basement instead of GitHub Actions. This uses residential IP addresses which are less likely to be flagged by Nextdoor's bot detection.

#### Setup Script

Create a setup script to configure the environment:

```bash
#!/bin/bash
# scraper/scripts/setup-local.sh

set -e

echo "Setting up Nextdoor scraper..."

# Install system dependencies
sudo apt update
sudo apt install -y python3.11 python3.11-venv

# Create virtual environment
cd /home/user/nextdoor/scraper
python3.11 -m venv venv
source venv/bin/activate

# Install Python dependencies
          pip install -r requirements.txt
          playwright install chromium
      
echo "Setup complete!"
```

#### Cron Jobs (Dual-Feed Strategy + Embeddings)

Add these to crontab (`crontab -e`):

```bash
# Nextdoor Scraper - Dual Feed Strategy
# Scrape Recent feed at 8:00 AM local time
0 8 * * * cd /home/user/nextdoor/scraper && ./scripts/run-scrape.sh recent >> /var/log/nextdoor/recent.log 2>&1

# Scrape Trending feed at 2:00 PM local time  
0 14 * * * cd /home/user/nextdoor/scraper && ./scripts/run-scrape.sh trending >> /var/log/nextdoor/trending.log 2>&1

# Generate embeddings for all posts without them (once per day at 10:00 PM)
0 22 * * * cd /home/user/nextdoor/scraper && ./scripts/run-embeddings.sh >> /var/log/nextdoor/embeddings.log 2>&1
```

#### Run Script with Healthchecks.io

```bash
#!/bin/bash
# scraper/scripts/run-scrape.sh

set -e

FEED_TYPE=${1:-recent}
HEALTHCHECK_URL="https://hc-ping.com/YOUR-UUID-HERE"

cd /home/user/nextdoor/scraper
source venv/bin/activate
source .env

echo "$(date): Starting $FEED_TYPE scrape..."

# Run scraper
if python -m src.main --feed-type "$FEED_TYPE" --max-posts 250 --score; then
    echo "$(date): Scrape successful"
    # Ping healthcheck on success
    curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL" > /dev/null
else
    echo "$(date): Scrape failed"
    # Ping healthcheck with failure
    curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL/fail" > /dev/null
    exit 1
fi
```

#### Embeddings Script

```bash
#!/bin/bash
# scraper/scripts/run-embeddings.sh

set -e

HEALTHCHECK_URL="https://hc-ping.com/YOUR-EMBEDDINGS-UUID-HERE"

cd /home/user/nextdoor/scraper
source venv/bin/activate
source .env

echo "$(date): Starting embedding generation..."

# Generate embeddings for posts without them
# The embedder automatically skips posts that already have embeddings
# Uses standalone embed.py script (no browser, no scraping)
if python -m src.embed; then
    echo "$(date): Embedding generation successful"
    # Ping healthcheck on success
    curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL" > /dev/null
else
    echo "$(date): Embedding generation failed"
    # Ping healthcheck with failure
    curl -fsS -m 10 --retry 5 "$HEALTHCHECK_URL/fail" > /dev/null
    exit 1
fi
```

#### Environment File

Create `/home/user/nextdoor/scraper/.env`:

```bash
# Nextdoor credentials
NEXTDOOR_EMAIL=your-email@example.com
NEXTDOOR_PASSWORD=your-password

# API keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Session encryption
SESSION_ENCRYPTION_KEY=base64-encoded-key
```

#### Healthchecks.io Monitoring

1. Sign up at https://healthchecks.io (free tier: 20 checks)
2. Create three checks:
   - "Nextdoor Recent" (8:00 AM daily)
   - "Nextdoor Trending" (2:00 PM daily)
   - "Nextdoor Embeddings" (10:00 PM daily)
3. Set schedule to match cron times
4. Set grace period to 30 minutes for scrapes, 1 hour for embeddings
5. Configure email/Slack alerts for failures

**Benefits**:
- Get notified if scraper fails or doesn't run
- See history of successful runs
- Monitor embedding generation separately
- No cost (free tier supports up to 20 checks)

#### Web Deploy (On Push)

```yaml
# .github/workflows/deploy.yml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'web/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./web
```

---

## 15. Design Decisions

### Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Repository** | Monorepo | Simpler for solo/small team |
| **Scraper Compute** | Local Linux laptop | Residential IP avoids bot detection, unlike datacenter IPs |
| **Database** | Supabase Free | PostgreSQL + pgvector, 500MB free |
| **LLM Model** | Claude Haiku | 20x cheaper than Sonnet |
| **Embeddings** | OpenAI | Cheap, proven quality |
| **Secrets** | .env file (local) | Simple for local deployment |
| **Frontend Host** | Vercel Free | Best Next.js support |
| **Auth** | NextAuth + Google | Simple, secure |
| **Monitoring** | Healthchecks.io | Free, alerts on cron failures |
| **Sports Facts** | Claude Haiku on-demand | Fun feature, negligible cost |

### Trade-offs Accepted

| Trade-off | Impact | Mitigation |
|-----------|--------|------------|
| Monorepo | Larger clone | Still small project |
| Local laptop | Requires always-on | UPS + reliable internet |
| Supabase 500MB | ~62K posts max | Years of runway |
| Haiku vs Sonnet | Less nuanced | Good enough |

---

## 16. Implementation Checklist

### Phase 1: Foundation

- [x] **1.1** Initialize repository structure
  - [x] Create directory structure per Section 5
  - [x] Set up Python project with `pyproject.toml`
  - [x] Set up Next.js project with TypeScript
  - [x] Create `docker-compose.yml`
  - [x] Create `.env.example` files
  - [x] Create `Makefile`

- [x] **1.2** Supabase setup
  - [x] Create Supabase project (free tier)
  - [x] Enable pgvector extension
  - [ ] Run SQL migrations (Section 7) — need to run in Supabase SQL Editor
  - [ ] Create seed data
  - [x] Note down URL and keys

- [ ] **1.3** GitHub setup
  - [ ] Add all secrets (Section 11)
  - [ ] Test with simple workflow

### Phase 2: Scraper

- [x] **2.1** Login & Session Management ✅ COMPLETE
  - [x] Session manager with Supabase (encrypted cookies)
  - [x] Playwright setup (headless + visible mode via `--visible`)
  - [x] Login flow with human-like typing delays
  - [x] CAPTCHA detection
  - [x] Login error handling
  - [x] Cookie persistence and reuse

- [x] **2.2** Post Extraction ✅ COMPLETE
  - [x] Add `--feed-type` CLI argument (recent/trending)
  - [x] Navigate to correct feed tab
  - [x] Scroll and load posts (infinite scroll handling)
  - [x] Parse post DOM structure (text, author, timestamp, images)
  - [x] SHA256 deduplication hash
  - [x] Insert new posts to Supabase
  - [x] Add `--max-posts` CLI argument (default 250)

- [x] **2.3** Post Extraction Improvements ✅ COMPLETE
  - [x] Store image URLs (already implemented in JSONB array)
  - [x] Extract post permalink (via Share modal) - use `--extract-permalinks` flag
  - [ ] Improve stopping logic (timestamp-based or DB dedup check) - moved to 2.5

- [x] **2.4** Reliability ✅ COMPLETE
  - [x] Retry logic (tenacity for transient failures)
  - [x] Custom exceptions (CaptchaRequiredError, LoginFailedError, etc.)
  - [x] Structured logging
  - [x] Dry-run mode (working)
  - [x] Context manager for browser cleanup

- [ ] **2.5** Stopping Logic Improvements (OPTIONAL - nice to have)
  - [ ] Timestamp-based stopping (stop when posts are >24h old)
  - [ ] DB dedup check before processing (skip posts already in DB)
  - [ ] Note: Current logic stops after MAX_EMPTY_SCROLLS with no new posts

- [ ] **2.6** Local Deployment (Linux laptop in basement)
  - [ ] Create setup script (`scripts/setup-local.sh`)
  - [ ] Create run script with Healthchecks.io (`scripts/run-scrape.sh`)
  - [ ] Configure cron jobs (6 AM recent, 6 PM trending)
  - [ ] Set up `.env` file with secrets
  - [ ] Sign up for Healthchecks.io and configure alerts
  - [ ] Verify cron jobs running and data in Supabase

### Phase 3: LLM Integration ✅ MOSTLY COMPLETE

See [Section 1.3: LLM Scoring Strategy](#13-llm-scoring-strategy) for full context on dimensions, categories, and novelty.

- [x] **3.1** Database Schema Updates ✅ COMPLETE
  - [x] Create migration for updated `llm_scores` table (JSONB scores, categories array)
  - [x] Create `topic_frequencies` table
  - [x] Add `ranking_weights` to `settings` table
  - [x] Run migrations in Supabase

- [x] **3.2** Claude Haiku Scoring (`llm_scorer.py`) ✅ COMPLETE
  - [x] Create scoring prompt template (5 dimensions + categories + summary)
  - [x] Implement `LLMScorer` class with `score_posts()` method
  - [x] Parse JSON response from Claude
  - [x] Handle API errors and rate limits (tenacity retry)
  - [x] Store results in `llm_scores` table
  - [x] Add `--score` CLI flag to main.py

- [x] **3.3** Topic Frequency Tracking ✅ COMPLETE
  - [x] Update `topic_frequencies` counts when scoring posts
  - [x] Implement 30-day rolling window (recount_topic_frequencies RPC)
  - [x] Calculate novelty multiplier based on category frequency

- [x] **3.4** Final Score Calculation ✅ COMPLETE
  - [x] Load weights from config/settings
  - [x] Implement weighted score formula
  - [x] Apply novelty multiplier
  - [x] Store `final_score` in `llm_scores`

- [ ] **3.5** OpenAI Embeddings (`embedder.py`) - OPTIONAL
  - [ ] Create `Embedder` class
  - [ ] Batch API calls (up to 100 texts per request)
  - [ ] Store vectors in `post_embeddings` table
  - [ ] Add `--embed` CLI flag or integrate into pipeline

- [x] **3.6** Integration & Testing ✅ COMPLETE
  - [x] Run scoring on existing posts (tested with 25 posts)
  - [x] Scoring integrated into main pipeline (`--score` flag)

### Phase 4: Web UI

- [x] **4.1** Authentication ✅ COMPLETE
  - [x] NextAuth.js + Google OAuth
  - [x] Email whitelist
  - [x] Protected routes (middleware)

- [x] **4.2** API Routes ✅ COMPLETE
  - [x] `GET /api/posts` - List posts with scores, pagination, filtering
  - [x] `GET /api/stats` - Dashboard statistics
  - [x] `PATCH /api/posts/[id]/used` - Mark post as used in episode
  - [x] API route tests (34 tests passing)

- [x] **4.3** Core Pages ✅ COMPLETE
  - [x] Post feed with pagination (uses `/api/posts`)
  - [ ] Post detail page
  - [x] Search page (semantic search implemented)
  - [x] Settings page (weight configs, jobs, search defaults)

- [x] **4.4** Components ✅ COMPLETE
  - [x] PostCard
  - [x] PostFeed
  - [x] StatsPanel
  - [x] JobStats
  - [x] JobsList
  - [x] WeightConfigsList
  - [x] **SportsFact** (for special user)
  - [x] ErrorBoundary

- [ ] **4.5** UI Polish & Styling
  - [ ] Review and improve CSS/Tailwind styling across all pages
  - [ ] Ensure consistent design system (colors, spacing, typography)
  - [ ] Improve mobile responsiveness
  - [ ] Polish component animations and transitions
  - [ ] Improve loading states and skeletons
  - [ ] Enhance error states and empty states
  - [ ] Review accessibility (ARIA labels, keyboard navigation)
  - [ ] Test UI on different screen sizes
  - [ ] Ensure dark mode theme is consistent

### Phase 5: Deployment

- [ ] **5.1** Vercel setup
  - [ ] Connect repo
  - [ ] Environment variables
  - [ ] Custom domain (optional)

- [ ] **5.2** Finalize
  - [ ] Deploy workflow
  - [ ] Enable schedule
  - [ ] Test end-to-end

### Phase 6: Launch

- [ ] **6.1** Testing
  - [ ] Run scraper
  - [x] Test UI features (basic navigation working)
  - [x] Test auth (Google OAuth working)
  - [ ] Test sports facts (API ready, needs debugging)

- [ ] **6.2** Go live
  - [ ] Enable daily schedule
  - [ ] Monitor first week
  - [ ] Check API costs

---

## Appendix: Quick Reference

### Key Commands

```bash
# Local development
make db-up                    # Start local Postgres
make dev-web                  # Start Next.js dev server
make dev-scraper              # Run scraper in dry-run mode
make gen-key                  # Generate encryption key

# Manual workflow trigger
gh workflow run scrape.yml
```

### Important URLs

| Service | URL |
|---------|-----|
| Supabase | https://app.supabase.com |
| Vercel | https://vercel.com/dashboard |
| Healthchecks.io | https://healthchecks.io/checks/ |
| Anthropic | https://console.anthropic.com |
| OpenAI | https://platform.openai.com |

### Cost Monitoring

Check monthly:
- **Anthropic** → Usage → Haiku costs
- **OpenAI** → Usage → Embeddings costs
- **Supabase** → Usage → Storage
- **Vercel** → Usage → Bandwidth
