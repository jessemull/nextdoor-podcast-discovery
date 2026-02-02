# Podcast Post Discovery Platform — Architecture

> Technical architecture and implementation plan for the Nextdoor post discovery system.
> 
> **Cost Target**: ~$1–$5/month using free tiers and cost-optimized services.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Layers](#2-architecture-layers)
3. [Technology Stack](#3-technology-stack)
4. [Cost Breakdown](#4-cost-breakdown)
5. [Data Flow](#5-data-flow)
6. [Database Schema](#6-database-schema)
7. [Component Specifications](#7-component-specifications)
8. [Infrastructure](#8-infrastructure)
9. [Security & Authentication](#9-security--authentication)
10. [Error Handling & Monitoring](#10-error-handling--monitoring)
11. [Development Setup](#11-development-setup)
12. [Deployment Pipeline](#12-deployment-pipeline)
13. [Design Decisions](#13-design-decisions)
14. [Implementation Checklist](#14-implementation-checklist)

---

## 1. System Overview

A platform that automatically discovers, analyzes, and curates interesting Nextdoor posts for podcast content.

### Core Capabilities

| Capability | Description |
|------------|-------------|
| **Automated Scraping** | Daily collection of posts from configured neighborhoods |
| **LLM Analysis** | Score posts on humor, absurdity, drama, relatability |
| **Semantic Search** | Find related posts by meaning, not just keywords |
| **Curation Dashboard** | Private web UI for browsing, filtering, and selecting posts |
| **Episode Tracking** | Mark posts as used, prevent duplicates |

### Cost-Optimized Approach

This architecture prioritizes **free tiers** and **pay-per-use** services:

| Traditional Approach | Our Approach | Savings |
|---------------------|--------------|---------|
| EC2 ($15/mo) | GitHub Actions (free) | $15/mo |
| RDS ($15/mo) | Supabase Free (free) | $15/mo |
| AWS Secrets Manager ($2/mo) | GitHub Secrets (free) | $2/mo |
| CloudWatch ($5/mo) | GitHub Actions logs (free) | $5/mo |
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
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROCESSING LAYER (GitHub Actions)                    │
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
│  │  • posts              — Raw post data                             │  │
│  │  • llm_scores         — Claude analysis results                   │  │
│  │  • post_embeddings    — Vector representations                    │  │
│  │  • rankings           — Calculated scores, episode usage          │  │
│  │  • neighborhoods      — Configuration                             │  │
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
│  │  (via scraper)  │  │  (scoring)      │  │  (vector generation)    │  │
│  │                 │  │  ~$0.25/1M in   │  │  $0.02/1M tokens        │  │
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
| Scraper Runtime | GitHub Actions | Free | 2,000 min/month free tier |
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
| Compute | EC2, Lambda, Railway | **GitHub Actions** | Free, Playwright support, scheduled |
| LLM | Claude Sonnet, GPT-4 | **Claude Haiku** | 20x cheaper, fast, good enough |
| Hosting | Amplify, Netlify, Railway | **Vercel** | Best Next.js support, free tier |

---

## 4. Cost Breakdown

### Monthly Costs (Estimated)

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| **Supabase** | Free | $0.00 | 500MB storage, 2GB bandwidth |
| **Vercel** | Hobby | $0.00 | 100GB bandwidth, serverless |
| **GitHub Actions** | Free | $0.00 | 2,000 min/month (need ~150) |
| **Claude Haiku** | Pay-per-use | ~$0.50–$1.00 | ~500 posts × ~500 tokens |
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
| GitHub Actions | 2,000 min/mo | Jobs queue until next month |

### Storage Estimate

```
Per post (average):
  - posts table:        ~500 bytes
  - llm_scores:         ~200 bytes
  - post_embeddings:    ~6KB (1536 floats × 4 bytes)
  - rankings:           ~50 bytes
  - indexes:            ~1KB
  ─────────────────────────────
  Total per post:       ~8KB

500MB limit ÷ 8KB = ~62,500 posts

At 500 posts/month = ~10 years before hitting limit
```

---

## 5. Data Flow

### Daily Pipeline (GitHub Actions)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  SCHEDULED WORKFLOW: Daily @ 2:00 AM UTC                                │
│  ────────────────────────────────────────────────────────────────────── │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  JOB 1: SCRAPE (~3 minutes)                                        │  │
│  │  ──────────────────────────────────────────────────────────────── │  │
│  │  1. Install Playwright + browsers                                 │  │
│  │  2. Load session cookies from Supabase (or login fresh)           │  │
│  │  3. For each active neighborhood:                                 │  │
│  │     a. Navigate to feed (mobile view)                             │  │
│  │     b. Scroll and extract posts                                   │  │
│  │     c. Compute SHA256 hash                                        │  │
│  │     d. Skip if hash exists (dedup)                                │  │
│  │     e. Insert new posts                                           │  │
│  │  4. Save updated session cookies to Supabase                      │  │
│  │  5. Output: List of new post IDs                                  │  │
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
│  │  3. Upsert into rankings table                                    │  │
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
│  └── Query: JOIN posts + llm_scores + rankings                          │
│      └── Filter: neighborhood, tags, used_on_episode                    │
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
│  └── Update: rankings.used_on_episode = true                            │
│  └── Update: rankings.episode_date = NOW()                              │
│                                                                          │
│  PUT /api/settings                                                       │
│  └── Update ranking weights                                             │
│  └── Trigger re-rank (or lazy re-rank on next fetch)                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  neighborhoods  │       │     posts       │       │   llm_scores    │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id          PK  │◄──┐   │ id          PK  │◄──────│ id          PK  │
│ name            │   │   │ neighborhood_id │───────│ post_id     FK  │
│ slug            │   └───│ post_id_ext     │       │ absurdity       │
│ is_active       │       │ user_id_hash    │       │ humor           │
│ weight_modifier │       │ text            │       │ drama           │
│ created_at      │       │ hash            │       │ relatability    │
│ updated_at      │       │ url             │       │ podcast_score   │
└─────────────────┘       │ image_urls      │       │ tags        JSON│
                          │ posted_at       │       │ summary         │
┌─────────────────┐       │ created_at      │       │ processed_at    │
│    sessions     │       └─────────────────┘       └─────────────────┘
├─────────────────┤                │
│ id          PK  │ ┌──────────────┼──────────────┐
│ neighborhood_id │ │              │              │
│ cookies_enc     │ ▼              ▼              ▼
│ expires_at      │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ updated_at      │ │ post_embeddings │ │    rankings     │ │   settings      │
└─────────────────┘ ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
                    │ id          PK  │ │ id          PK  │ │ id          PK  │
                    │ post_id     FK  │ │ post_id     FK  │ │ key             │
                    │ embedding VECTOR│ │ final_score     │ │ value       JSON│
                    │ model           │ │ used_on_episode │ │ updated_at      │
                    │ created_at      │ │ episode_date    │ └─────────────────┘
                    └─────────────────┘ │ updated_at      │
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

```sql
CREATE TABLE llm_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    absurdity FLOAT CHECK (absurdity >= 0 AND absurdity <= 10),
    humor FLOAT CHECK (humor >= 0 AND humor <= 10),
    drama FLOAT CHECK (drama >= 0 AND drama <= 10),
    relatability FLOAT CHECK (relatability >= 0 AND relatability <= 10),
    podcast_score FLOAT,                       -- Raw LLM opinion
    tags JSONB DEFAULT '[]',
    summary TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_scores_post ON llm_scores(post_id);
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

#### `rankings`

```sql
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
```

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

## 7. Component Specifications

### 7.1 Scraper (GitHub Actions)

**Location**: `/scraper/`

**Runs in**: GitHub Actions Ubuntu runner

**Key Files**:

```
/scraper/
├── __init__.py
├── main.py                    # Entry point for GitHub Action
├── session_manager.py         # Cookie persistence via Supabase
├── post_extractor.py          # DOM parsing logic
├── scraper.py                 # Main orchestrator
├── config.py                  # Configuration
└── requirements.txt
```

**Session Manager** (stores cookies in Supabase):

```python
# scraper/session_manager.py
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

**Configuration**:

```python
# scraper/config.py
SCRAPER_CONFIG = {
    "headless": True,                    # GitHub Actions = headless only
    "scroll_delay_ms": (2000, 5000),     # Random delay range
    "max_posts_per_run": 100,
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
}
```

### 7.2 LLM Scoring Worker

**Location**: `/scraper/llm_scorer.py` (runs in same GitHub Action)

**Model**: Claude Haiku (`claude-3-haiku-20240307`)

**Why Haiku over Sonnet?**
- 20x cheaper ($0.25 vs $3 per 1M input tokens)
- Faster (important in GitHub Actions with time limits)
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

**Implementation**:

```python
# scraper/llm_scorer.py
import anthropic

client = anthropic.Anthropic()  # Uses ANTHROPIC_API_KEY env var

def score_posts(posts: list[dict]) -> list[dict]:
    """Score multiple posts with Claude Haiku."""
    results = []
    
    for post in posts:
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": SCORING_PROMPT.format(post_text=post["text"])
            }]
        )
        
        # Parse JSON from response
        scores = json.loads(response.content[0].text)
        scores["post_id"] = post["id"]
        results.append(scores)
    
    return results
```

### 7.3 Embedding Worker

**Location**: `/scraper/embedder.py`

**Model**: OpenAI `text-embedding-3-small` (1536 dimensions)

**Implementation**:

```python
# scraper/embedder.py
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

### 7.4 Web UI

**Location**: `/web/`

**Hosting**: Vercel (Free Tier)

**Database Connection**: Supabase client

**Key Files**:

```
/web/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── posts/route.ts
│   │   ├── posts/[id]/route.ts
│   │   ├── posts/[id]/use/route.ts
│   │   ├── search/route.ts
│   │   └── settings/route.ts
│   ├── page.tsx                    # Main feed
│   ├── search/page.tsx
│   ├── post/[id]/page.tsx
│   └── settings/page.tsx
├── components/
│   ├── PostCard.tsx
│   ├── PostFeed.tsx
│   ├── SearchBar.tsx
│   ├── RankingSliders.tsx
│   ├── TagFilter.tsx
│   └── NeighborhoodFilter.tsx
├── lib/
│   ├── supabase.ts               # Supabase client
│   ├── auth.ts                   # NextAuth config
│   └── api.ts                    # API helpers
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

## 8. Infrastructure

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GITHUB                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Repository: nextdoor-podcast                                     │  │
│  │  ├── /scraper (Python)                                           │  │
│  │  ├── /web (Next.js)                                              │  │
│  │  └── /.github/workflows                                          │  │
│  │                                                                   │  │
│  │  Secrets:                                                         │  │
│  │  ├── NEXTDOOR_EMAIL, NEXTDOOR_PASSWORD                           │  │
│  │  ├── ANTHROPIC_API_KEY, OPENAI_API_KEY                           │  │
│  │  ├── SUPABASE_URL, SUPABASE_KEY                                  │  │
│  │  ├── SESSION_ENCRYPTION_KEY                                      │  │
│  │  └── VERCEL_TOKEN (for deploy)                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│              ┌───────────────┴───────────────┐                          │
│              ▼                               ▼                          │
│  ┌─────────────────────┐         ┌─────────────────────┐               │
│  │  Actions: Scraper   │         │  Actions: Deploy    │               │
│  │  (scheduled, daily) │         │  (on push to main)  │               │
│  │                     │         │                     │               │
│  │  • Runs Playwright  │         │  • Deploys to Vercel│               │
│  │  • Calls Claude     │         │                     │               │
│  │  • Calls OpenAI     │         │                     │               │
│  └──────────┬──────────┘         └──────────┬──────────┘               │
│             │                               │                           │
└─────────────│───────────────────────────────│───────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│       SUPABASE          │       │        VERCEL           │
│  (Free Tier)            │       │  (Hobby Tier)           │
│                         │       │                         │
│  PostgreSQL + pgvector  │◄──────│  Next.js App            │
│  • 500MB storage        │       │  • API Routes           │
│  • 2GB bandwidth        │       │  • SSR Pages            │
│  • Unlimited API calls  │       │  • Auth (NextAuth)      │
└─────────────────────────┘       └─────────────────────────┘
```

### No AWS Required!

This architecture eliminates all AWS dependencies:

| Previously | Now |
|------------|-----|
| EC2 | GitHub Actions |
| RDS | Supabase |
| Secrets Manager | GitHub Secrets |
| CloudWatch | GitHub Actions logs |
| S3 | Not needed (skip HTML backups) |

---

## 9. Security & Authentication

### Web UI Authentication

Using NextAuth.js with Google OAuth + email whitelist:

```typescript
// web/lib/auth.ts
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const ALLOWED_EMAILS = [
  "your-email@example.com",
  // Add more as needed
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

### Session Cookie Security

- Cookies encrypted with **AES-256** (Fernet) before storage
- Encryption key stored in GitHub Secrets
- 7-day TTL, auto-refresh on successful scrape

### Data Privacy

| Data | Handling |
|------|----------|
| User IDs | Hashed (SHA256) before storage |
| Post content | Stored as-is (public posts) |
| Session cookies | Encrypted at rest |

---

## 10. Error Handling & Monitoring

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

class CaptchaRequiredError(ScraperError):
    """CAPTCHA challenge detected."""
    pass
```

### GitHub Actions Notifications

Since we're not using CloudWatch, we use GitHub's built-in notifications:

```yaml
# In workflow file
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

Or use the **Slack GitHub App** for notifications.

### Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logger.info(
    "scrape_complete",
    extra={
        "neighborhood": "downtown",
        "posts_found": 47,
        "posts_new": 12,
        "duration_seconds": 145
    }
)
```

Logs are visible in GitHub Actions run history.

---

## 11. Development Setup

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

# Set up local database (for development only)
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
# Edit .env.local with your API keys (get from Supabase dashboard)
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
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql

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
	cd scraper && python -m scraper.main --dry-run

dev-web:
	cd web && npm run dev

test:
	cd scraper && pytest
	cd web && npm test

# Generate new encryption key for sessions
gen-key:
	python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Environment Variables

**For Scraper** (`.env` or GitHub Secrets):

```bash
# Nextdoor credentials
NEXTDOOR_EMAIL="your-email@example.com"
NEXTDOOR_PASSWORD="your-password"

# APIs
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# Supabase
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_KEY="eyJ..."

# Session encryption (generate with: make gen-key)
SESSION_ENCRYPTION_KEY="..."
```

**For Web** (`web/.env.local`):

```bash
# Supabase (public)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Supabase (server-side)
SUPABASE_URL="https://xxxxx.supabase.co"
SUPABASE_SERVICE_KEY="eyJ..."

# Auth
NEXTAUTH_SECRET="random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

---

## 12. Deployment Pipeline

### GitHub Actions Workflows

#### Scraper (Daily Schedule)

```yaml
# .github/workflows/scrape.yml
name: Daily Scrape

on:
  schedule:
    - cron: '0 2 * * *'  # 2:00 AM UTC daily
  workflow_dispatch:      # Allow manual trigger

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd scraper
          pip install -r requirements.txt
          playwright install chromium
      
      - name: Run scraper
        env:
          NEXTDOOR_EMAIL: ${{ secrets.NEXTDOOR_EMAIL }}
          NEXTDOOR_PASSWORD: ${{ secrets.NEXTDOOR_PASSWORD }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          SESSION_ENCRYPTION_KEY: ${{ secrets.SESSION_ENCRYPTION_KEY }}
        run: |
          cd scraper
          python -m scraper.main
      
      - name: Run LLM scoring
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: |
          cd scraper
          python -m scraper.llm_scorer
      
      - name: Generate embeddings
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: |
          cd scraper
          python -m scraper.embedder
      
      - name: Update rankings
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: |
          cd scraper
          python -m scraper.ranker
```

#### Web Deploy (On Push)

```yaml
# .github/workflows/deploy-web.yml
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

### First-Time Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create new project (free tier)
   - Run SQL from Section 6 to create tables
   - Copy URL and keys

2. **Set Up GitHub Secrets**
   - Go to repo → Settings → Secrets
   - Add all secrets from Section 11

3. **Set Up Vercel**
   - Connect repo to Vercel
   - Set environment variables
   - Get `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

4. **Configure Google OAuth**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth credentials
   - Add authorized redirect: `https://your-app.vercel.app/api/auth/callback/google`

5. **Run Initial Scrape**
   - Go to Actions → Daily Scrape → Run workflow
   - Monitor logs for any issues

---

## 13. Design Decisions

### Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Compute** | GitHub Actions | Free 2,000 min/month, Playwright support |
| **Database** | Supabase Free | PostgreSQL + pgvector, 500MB free |
| **LLM Model** | Claude Haiku | 20x cheaper than Sonnet, fast enough |
| **Embeddings** | OpenAI | $0.02/1M tokens, proven quality |
| **Secrets** | GitHub Secrets | Free, integrated with Actions |
| **Frontend Host** | Vercel Free | Best Next.js support |
| **Auth** | NextAuth + Google | Simple, secure, free |
| **Session Storage** | Supabase (encrypted) | No need for separate storage |
| **HTML Backups** | Skip | Not worth storage cost for MVP |
| **Monitoring** | GitHub Actions logs | Free, sufficient for low volume |

### Trade-offs Accepted

| Trade-off | Impact | Mitigation |
|-----------|--------|------------|
| GitHub Actions limit | 2,000 min/month | Only need ~150 min/month |
| Supabase 500MB | ~62K posts max | Years of runway at 500/month |
| Haiku vs Sonnet | Slightly less nuanced | Good enough for scoring humor |
| No CloudWatch | Less observability | GitHub logs + manual monitoring |
| No HTML backups | Can't debug old scrapes | Accept the risk for cost savings |

### Future Upgrades (If Needed)

| Trigger | Upgrade Path | New Cost |
|---------|--------------|----------|
| Hit 500MB | Supabase Pro | +$25/mo |
| Need better LLM | Claude Sonnet | +$10/mo |
| More scraping | Railway or EC2 spot | +$5-15/mo |
| Team access | Vercel Pro | +$20/mo |

---

## 14. Implementation Checklist

### Phase 1: Foundation

- [ ] **1.1** Initialize repository structure
  - [ ] Create `/scraper`, `/web` directories
  - [ ] Set up Python project with `pyproject.toml` and `requirements.txt`
  - [ ] Set up Next.js project with TypeScript
  - [ ] Create `docker-compose.yml` for local dev
  - [ ] Create `.env.example` files

- [ ] **1.2** Supabase setup
  - [ ] Create Supabase project (free tier)
  - [ ] Enable pgvector extension
  - [ ] Run SQL to create all tables
  - [ ] Create seed script with test neighborhood
  - [ ] Note down URL and keys

- [ ] **1.3** GitHub setup
  - [ ] Create repository
  - [ ] Add all secrets (see Section 11)
  - [ ] Test secret access with simple workflow

### Phase 2: Scraper

- [ ] **2.1** Core scraper implementation
  - [ ] Session manager with Supabase storage
  - [ ] Cookie encryption/decryption
  - [ ] Playwright browser setup (headless)
  - [ ] Post extractor (DOM parsing)
  - [ ] Deduplication logic (hash-based)

- [ ] **2.2** Scraper reliability
  - [ ] Retry logic with exponential backoff
  - [ ] Error classification
  - [ ] Logging
  - [ ] Dry-run mode for testing

- [ ] **2.3** GitHub Actions workflow
  - [ ] Create `.github/workflows/scrape.yml`
  - [ ] Test with manual trigger
  - [ ] Verify data appears in Supabase

### Phase 3: LLM Integration

- [ ] **3.1** Claude Haiku scoring worker
  - [ ] Prompt template
  - [ ] JSON response parsing
  - [ ] Batch processing
  - [ ] Error handling

- [ ] **3.2** OpenAI embeddings worker
  - [ ] Embedding generation
  - [ ] Batch API calls
  - [ ] Store in pgvector

- [ ] **3.3** Ranking calculation
  - [ ] Implement ranking formula
  - [ ] Read weights from settings table
  - [ ] Update rankings table

### Phase 4: Web UI

- [ ] **4.1** Authentication
  - [ ] NextAuth.js setup
  - [ ] Google OAuth provider
  - [ ] Email whitelist protection
  - [ ] Protected routes

- [ ] **4.2** Core pages
  - [ ] Post feed with pagination
  - [ ] Post detail page
  - [ ] Search page (keyword + semantic)
  - [ ] Settings page (ranking weights)

- [ ] **4.3** UI components
  - [ ] PostCard component
  - [ ] RankingSliders component
  - [ ] TagFilter component
  - [ ] NeighborhoodFilter component
  - [ ] SearchBar with semantic toggle

- [ ] **4.4** API routes
  - [ ] GET /api/posts
  - [ ] GET /api/posts/:id
  - [ ] POST /api/posts/:id/use
  - [ ] GET /api/search
  - [ ] PUT /api/settings

### Phase 5: Deployment

- [ ] **5.1** Vercel setup
  - [ ] Connect repo to Vercel
  - [ ] Configure environment variables
  - [ ] Set up custom domain (optional)

- [ ] **5.2** GitHub Actions finalization
  - [ ] Deploy workflow for web
  - [ ] Enable scheduled scrape workflow
  - [ ] Test full pipeline end-to-end

- [ ] **5.3** Documentation
  - [ ] README with setup instructions
  - [ ] Document environment variables
  - [ ] Runbook for common issues

### Phase 6: Launch

- [ ] **6.1** Final testing
  - [ ] Run scraper manually, verify data
  - [ ] Test all UI features
  - [ ] Test auth flow
  - [ ] Test semantic search

- [ ] **6.2** Go live
  - [ ] Enable daily schedule
  - [ ] Monitor first 3 days of runs
  - [ ] Check API costs in dashboards

---

## Appendix: Quick Reference

### Key Commands

```bash
# Local development
make db-up                    # Start local Postgres
make dev-web                  # Start Next.js dev server
make dev-scraper              # Run scraper in dry-run mode

# Generate encryption key
make gen-key

# Manual workflow trigger
gh workflow run scrape.yml    # Requires GitHub CLI
```

### Important URLs

| Service | URL |
|---------|-----|
| Supabase Dashboard | https://app.supabase.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| GitHub Actions | https://github.com/YOUR_USER/YOUR_REPO/actions |
| Anthropic Console | https://console.anthropic.com |
| OpenAI Dashboard | https://platform.openai.com |

### Cost Monitoring

Check these monthly:
- **Anthropic Console** → Usage → Check Haiku costs
- **OpenAI Dashboard** → Usage → Check embeddings costs
- **Supabase** → Project → Usage → Check storage
- **Vercel** → Project → Usage → Check bandwidth
