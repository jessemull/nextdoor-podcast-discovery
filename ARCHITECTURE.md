# Podcast Post Discovery Platform — Architecture

> Technical architecture and implementation plan for the Nextdoor post discovery system.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Layers](#2-architecture-layers)
3. [Technology Stack](#3-technology-stack)
4. [Data Flow](#4-data-flow)
5. [Database Schema](#5-database-schema)
6. [Component Specifications](#6-component-specifications)
7. [Infrastructure](#7-infrastructure)
8. [Security & Authentication](#8-security--authentication)
9. [Error Handling & Monitoring](#9-error-handling--monitoring)
10. [Development Setup](#10-development-setup)
11. [Deployment Pipeline](#11-deployment-pipeline)
12. [Design Decisions](#12-design-decisions)
13. [Implementation Checklist](#13-implementation-checklist)

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

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Next.js Web UI (Private Dashboard)                               │  │
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
│  │  Next.js API Routes                                               │  │
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
│                          PROCESSING LAYER                               │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │
│  │  Scraper Service    │  │  LLM Scoring Worker │  │  Embedding      │  │
│  │  (Python/Playwright)│  │  (Python)           │  │  Worker         │  │
│  │                     │  │                     │  │  (Python)       │  │
│  │  • Daily cron       │  │  • Claude API       │  │  • OpenAI API   │  │
│  │  • Session mgmt     │  │  • Score posts      │  │  • Generate     │  │
│  │  • Multi-neighbor   │  │  • Generate tags    │  │    vectors      │  │
│  │  • Dedup by hash    │  │  • Summarize        │  │  • Batch mode   │  │
│  │  • Rate limiting    │  │  • Batch processing │  │                 │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (RDS) + pgvector                                      │  │
│  │  • posts              — Raw post data                             │  │
│  │  • llm_scores         — Claude analysis results                   │  │
│  │  • post_embeddings    — Vector representations                    │  │
│  │  • rankings           — Calculated scores, episode usage          │  │
│  │  • neighborhoods      — Configuration                             │  │
│  │  • settings           — Ranking weights, preferences              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  S3 (Optional)                                                    │  │
│  │  • Raw HTML backups (30-day retention)                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  AWS Secrets Manager                                              │  │
│  │  • Nextdoor credentials                                           │  │
│  │  • Claude API key                                                 │  │
│  │  • OpenAI API key                                                 │  │
│  │  • Database credentials                                           │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL SERVICES                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  Nextdoor       │  │  Claude API     │  │  OpenAI Embeddings API  │  │
│  │  (via scraper)  │  │  (scoring)      │  │  (vector generation)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### Frontend

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | Next.js 14+ (App Router) | SSR, API routes, React ecosystem |
| Language | TypeScript | Type safety, better DX |
| Styling | Tailwind CSS | Rapid UI development |
| Auth | NextAuth.js | Easy setup, multiple providers |
| State | React Query (TanStack) | Server state management |

### Backend / Processing

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Scraper | Python 3.11+ / Playwright | Best browser automation support |
| Workers | Python 3.11+ | Same runtime as scraper |
| API | Next.js API Routes | Unified deployment with frontend |
| Task Queue | (Optional) Celery + Redis | If async processing needed |

### Data

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Database | PostgreSQL 16 | Robust, pgvector support |
| Vector Store | pgvector extension | Embeddings in same DB |
| Migrations | Prisma or Alembic | Schema versioning |

### External APIs

| Service | Provider | Purpose |
|---------|----------|---------|
| LLM Scoring | Claude (Anthropic) | Post analysis, tagging, summaries |
| Embeddings | OpenAI `text-embedding-3-small` | Vector generation for semantic search |

### Infrastructure

| Component | AWS Service | Notes |
|-----------|-------------|-------|
| Compute (Scraper) | EC2 t3.small or ECS Fargate | Cron-based execution |
| Database | RDS PostgreSQL | With pgvector, automated backups |
| Frontend Hosting | Vercel or Amplify | Simpler than self-hosted |
| Secrets | AWS Secrets Manager | Centralized credential storage |
| Monitoring | CloudWatch | Logs, metrics, alarms |
| Storage | S3 | Optional HTML backups |

---

## 4. Data Flow

### Daily Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│  1. SCRAPE (Daily @ 2:00 AM UTC)                                        │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │  For each active neighborhood:                                  │  │
│     │    1. Load or refresh session cookies                          │  │
│     │    2. Navigate to neighborhood feed (mobile view)              │  │
│     │    3. Scroll and extract posts                                 │  │
│     │    4. Compute SHA256 hash of post text                         │  │
│     │    5. Skip if hash exists in DB (dedup)                        │  │
│     │    6. Insert new posts into `posts` table                      │  │
│     │    7. Optionally store raw HTML in S3                          │  │
│     └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  2. ANALYZE (Triggered after scrape completes)                          │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │  Query posts without LLM scores:                               │  │
│     │    1. Batch posts (10 per request to reduce API calls)         │  │
│     │    2. Send to Claude with few-shot prompt                      │  │
│     │    3. Parse JSON response                                      │  │
│     │    4. Insert scores, tags, summary into `llm_scores`           │  │
│     │    5. Respect rate limits (exponential backoff)                │  │
│     └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  3. EMBED (Triggered after analysis completes)                          │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │  Query posts without embeddings:                               │  │
│     │    1. Batch posts (up to 100 per request)                      │  │
│     │    2. Send to OpenAI embeddings API                            │  │
│     │    3. Store vectors in `post_embeddings`                       │  │
│     └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  4. RANK (Triggered after embedding completes)                          │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │  For each post with scores:                                    │  │
│     │    1. Load current ranking weights from settings               │  │
│     │    2. Calculate: final_score = Σ(score × weight)               │  │
│     │    3. Upsert into `rankings` table                             │  │
│     └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  5. SERVE (On-demand via Web UI)                                        │
│     ┌─────────────────────────────────────────────────────────────────┐  │
│     │  User requests:                                                │  │
│     │    • Feed: JOIN posts + scores + rankings, ORDER BY final_score│  │
│     │    • Search: Text search OR vector similarity query            │  │
│     │    • Related: Vector similarity on selected post               │  │
│     │    • Mark used: Update rankings.used_on_episode                │  │
│     └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Database Schema

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
                          │ created_at      │       │ processed_at    │
                          └─────────────────┘       └─────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │ post_embeddings │ │    rankings     │ │   settings      │
          ├─────────────────┤ ├─────────────────┤ ├─────────────────┤
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `posts`

```sql
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    neighborhood_id UUID NOT NULL REFERENCES neighborhoods(id),
    post_id_ext VARCHAR(255) NOT NULL,              -- Nextdoor's post ID
    user_id_hash VARCHAR(64),                        -- SHA256 of user ID (anonymized)
    text TEXT NOT NULL,
    hash VARCHAR(64) NOT NULL,                       -- SHA256 of text for dedup
    url VARCHAR(512),
    image_urls JSONB DEFAULT '[]',
    posted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(neighborhood_id, hash)                    -- Prevent duplicates per neighborhood
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
    podcast_score FLOAT,                             -- Raw LLM opinion
    tags JSONB DEFAULT '[]',
    summary TEXT,
    processed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_llm_scores_post ON llm_scores(post_id);
```

#### `post_embeddings`

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    embedding VECTOR(1536),                          -- OpenAI text-embedding-3-small dimension
    model VARCHAR(50) DEFAULT 'text-embedding-3-small',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_vector ON post_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### `rankings`

```sql
CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL UNIQUE REFERENCES posts(id) ON DELETE CASCADE,
    final_score FLOAT NOT NULL DEFAULT 0,
    used_on_episode BOOLEAN DEFAULT false,
    episode_date DATE,
    updated_at TIMESTAMP DEFAULT NOW()
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
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Default ranking weights
INSERT INTO settings (key, value) VALUES 
    ('ranking_weights', '{"absurdity": 1.0, "humor": 1.0, "drama": 1.0, "relatability": 1.0}');
```

---

## 6. Component Specifications

### 6.1 Scraper Service

**Location**: `/scraper/`

**Responsibilities**:
- Log into Nextdoor (persist session cookies)
- Navigate neighborhood feeds
- Extract post data
- Deduplicate and store

**Key Classes**:

```python
# scraper/session_manager.py
class SessionManager:
    """Manages Nextdoor login sessions per neighborhood."""
    
    def get_cookies(neighborhood: str) -> list[dict] | None
    def save_cookies(neighborhood: str, cookies: list[dict]) -> None
    def is_session_valid(neighborhood: str) -> bool
    def clear_session(neighborhood: str) -> None

# scraper/post_extractor.py
class PostExtractor:
    """Extracts post data from Nextdoor pages."""
    
    def extract_posts(page: Page) -> list[RawPost]
    def scroll_and_load(page: Page, max_posts: int) -> None

# scraper/scraper.py
class NextdoorScraper:
    """Main scraper orchestrator."""
    
    def scrape_neighborhood(neighborhood: str) -> list[Post]
    def run_all() -> ScrapingResult
```

**Configuration**:

```python
# scraper/config.py
SCRAPER_CONFIG = {
    "headless": True,                    # Use headless with stealth
    "scroll_delay_ms": (2000, 5000),     # Random delay range
    "max_posts_per_run": 100,
    "session_storage_path": "./sessions",
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)...",
}
```

### 6.2 LLM Scoring Worker

**Location**: `/workers/llm_scorer/`

**Responsibilities**:
- Query unprocessed posts
- Call Claude API with structured prompt
- Parse and store results

**Prompt Template**:

```python
SCORING_PROMPT = """
Analyze the following Nextdoor post and provide scores and metadata.

Post:
{post_text}

Respond with a JSON object:
{
  "absurdity": <1-10 float>,
  "humor": <1-10 float>,
  "drama": <1-10 float>,
  "relatability": <1-10 float>,
  "podcast_worthiness": <1-10 float>,
  "tags": ["tag1", "tag2"],
  "summary": "<one line summary>"
}

Scoring guidelines:
- absurdity: How bizarre or unexpected is this situation?
- humor: How funny would this be to read on a podcast?
- drama: How much conflict or tension is present?
- relatability: Would listeners nod and say "that's so true"?
- podcast_worthiness: Overall, how good is this for the show?

Tags should be lowercase, hyphenated (e.g., "lost-pet", "neighbor-feud", "hoa-drama").
"""
```

### 6.3 Embedding Worker

**Location**: `/workers/embedder/`

**Responsibilities**:
- Query posts without embeddings
- Call OpenAI embeddings API
- Store vectors in pgvector

**Implementation**:

```python
from openai import OpenAI

client = OpenAI()

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    return [item.embedding for item in response.data]
```

### 6.4 Web UI

**Location**: `/web/`

**Pages**:

| Route | Purpose |
|-------|---------|
| `/` | Dashboard with ranked post feed |
| `/search` | Search interface (keyword + semantic) |
| `/post/[id]` | Post detail with related posts |
| `/settings` | Ranking weight configuration |
| `/neighborhoods` | Manage neighborhoods |

**Key Components**:

```
/web/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── posts/route.ts
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
└── lib/
    ├── db.ts                       # Prisma client
    ├── auth.ts                     # NextAuth config
    └── api.ts                      # API helpers
```

---

## 7. Infrastructure

### AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VPC                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Private Subnet                              │   │
│  │  ┌─────────────────┐        ┌─────────────────────────────────┐  │   │
│  │  │   EC2 Scraper   │        │        RDS PostgreSQL           │  │   │
│  │  │   t3.small      │───────▶│        db.t3.micro              │  │   │
│  │  │                 │        │        + pgvector               │  │   │
│  │  │  Cron: 2am UTC  │        │                                 │  │   │
│  │  └─────────────────┘        └─────────────────────────────────┘  │   │
│  │                                          ▲                       │   │
│  └──────────────────────────────────────────│───────────────────────┘   │
│                                             │                           │
└─────────────────────────────────────────────│───────────────────────────┘
                                              │
                          ┌───────────────────┴───────────────────┐
                          │                                       │
                ┌─────────▼─────────┐               ┌─────────────▼─────────┐
                │      Vercel       │               │   Secrets Manager     │
                │   (Next.js App)   │               │   • DB credentials    │
                │                   │               │   • API keys          │
                └───────────────────┘               └───────────────────────┘
                          │
                          ▼
                ┌───────────────────┐
                │    CloudWatch     │
                │   • Logs          │
                │   • Alarms        │
                └───────────────────┘
```

### Cost Breakdown (Monthly)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| EC2 | t3.small (on-demand) | $15 |
| RDS | db.t3.micro, 20GB | $15 |
| Secrets Manager | 4 secrets | $2 |
| CloudWatch | Basic metrics + logs | $5 |
| Vercel | Hobby/Pro | $0–$20 |
| Claude API | ~500 posts/month | $5–$10 |
| OpenAI Embeddings | ~500 posts/month | $0.50 |
| **Total** | | **~$40–$70/month** |

---

## 8. Security & Authentication

### Web UI Authentication

Using NextAuth.js with email whitelist:

```typescript
// web/lib/auth.ts
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

const ALLOWED_EMAILS = [
  "your-email@example.com",
  // Add team members as needed
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

### Secrets Management

All secrets stored in AWS Secrets Manager:

| Secret Name | Contents |
|-------------|----------|
| `nextdoor/credentials` | Nextdoor login email/password |
| `nextdoor/db` | Database connection string |
| `nextdoor/claude` | Anthropic API key |
| `nextdoor/openai` | OpenAI API key |

### Data Privacy

| Data | Handling |
|------|----------|
| User IDs | Hashed (SHA256) before storage |
| Post content | Stored as-is (public posts) |
| Session cookies | Encrypted at rest, 7-day TTL |
| Raw HTML | 30-day retention, then deleted |

---

## 9. Error Handling & Monitoring

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
    """Nextdoor session has expired."""
    pass

class RateLimitError(ScraperError):
    """Hit rate limit, need to back off."""
    pass

class CaptchaRequiredError(ScraperError):
    """CAPTCHA challenge detected."""
    pass
```

### CloudWatch Alarms

| Alarm | Condition | Action |
|-------|-----------|--------|
| Scraper Failed | Error count > 0 in 1 hour | SNS → Email |
| No Posts Scraped | Posts count = 0 after run | SNS → Email |
| High API Latency | Claude latency > 10s | Log warning |
| DB Connection Failed | Connection errors > 3 | SNS → Email |

### Logging Structure

```python
import structlog

logger = structlog.get_logger()

logger.info(
    "scrape_complete",
    neighborhood="downtown",
    posts_found=47,
    posts_new=12,
    duration_seconds=145
)
```

---

## 10. Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL client (optional)

### Local Environment

```bash
# Clone repository
git clone <repo-url>
cd nextdoor

# Start local database
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
# Edit .env.local with your API keys
```

### Docker Compose

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
.PHONY: dev db-up db-down migrate test

db-up:
	docker-compose up -d db

db-down:
	docker-compose down

migrate:
	cd web && npx prisma migrate deploy

seed:
	cd web && npx prisma db seed

dev-scraper:
	cd scraper && python -m scraper.main --dry-run

dev-web:
	cd web && npm run dev

test:
	cd scraper && pytest
	cd web && npm test
```

---

## 11. Deployment Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      
      - name: Install Python deps
        run: |
          cd scraper
          pip install -r requirements.txt
          pip install pytest
      
      - name: Run Python tests
        run: cd scraper && pytest
      
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Node deps
        run: cd web && npm ci
      
      - name: Run frontend tests
        run: cd web && npm test

  deploy-scraper:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ec2-user/nextdoor
            git pull origin main
            cd scraper
            source venv/bin/activate
            pip install -r requirements.txt
            sudo systemctl restart nextdoor-scraper

  deploy-web:
    needs: test
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

## 12. Design Decisions

### Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Embeddings Provider** | OpenAI | Claude doesn't offer embeddings; OpenAI is cheap and proven |
| **Browser Mode** | Headless + Stealth | Simpler than Xvfb; switch if blocked |
| **Frontend Framework** | Next.js | API routes + SSR in one package |
| **Vector DB** | pgvector | Keep everything in one DB; simpler ops |
| **Hosting** | Vercel (web) + EC2 (scraper) | Vercel for easy deploys; EC2 for browser automation |
| **Auth** | NextAuth.js + Google | Simple setup, secure, familiar |
| **Images** | Store URLs only | Display in UI without download/storage complexity |
| **Data Retention** | Posts: indefinite, HTML: 30 days | Balance archival vs storage costs |

### Future Considerations

| Item | Notes |
|------|-------|
| **CAPTCHA Handling** | May need 2Captcha if frequently challenged |
| **Multi-user Support** | Current design is single-user; could add user table later |
| **Image Analysis** | Claude Vision could score images if needed |
| **Podcast Script Gen** | Could auto-generate script drafts from top posts |

---

## 13. Implementation Checklist

### Phase 1: Foundation

- [ ] **1.1** Initialize repository structure
  - [ ] Create `/scraper`, `/web`, `/db`, `/infra` directories
  - [ ] Set up Python project with `pyproject.toml`
  - [ ] Set up Next.js project with TypeScript
  - [ ] Create `docker-compose.yml` for local dev

- [ ] **1.2** Database setup
  - [ ] Write initial migration with all tables
  - [ ] Enable pgvector extension
  - [ ] Create seed script with test data
  - [ ] Set up Prisma (or SQLAlchemy) models

- [ ] **1.3** Local development environment
  - [ ] Document setup in README
  - [ ] Create Makefile for common tasks
  - [ ] Add `.env.example` files

### Phase 2: Scraper

- [ ] **2.1** Core scraper implementation
  - [ ] Session manager (cookie persistence)
  - [ ] Playwright browser setup with stealth
  - [ ] Post extractor (DOM parsing)
  - [ ] Deduplication logic (hash-based)

- [ ] **2.2** Scraper reliability
  - [ ] Retry logic with exponential backoff
  - [ ] Error classification (session expired, rate limit, etc.)
  - [ ] Logging with structlog
  - [ ] Dry-run mode for testing

- [ ] **2.3** Multi-neighborhood support
  - [ ] Neighborhood configuration
  - [ ] Per-neighborhood session storage
  - [ ] Sequential scraping with delays

### Phase 3: LLM Integration

- [ ] **3.1** Claude scoring worker
  - [ ] Prompt template with few-shot examples
  - [ ] JSON response parsing
  - [ ] Batch processing (multiple posts per request)
  - [ ] Rate limit handling

- [ ] **3.2** OpenAI embeddings worker
  - [ ] Embedding generation
  - [ ] Batch API calls
  - [ ] Store in pgvector

- [ ] **3.3** Ranking calculation
  - [ ] Implement ranking formula
  - [ ] Configurable weights from settings table
  - [ ] Re-ranking on weight change

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
  - [ ] SemanticSearchInput component

- [ ] **4.4** API routes
  - [ ] GET /api/posts
  - [ ] GET /api/posts/:id
  - [ ] POST /api/posts/:id/use
  - [ ] GET /api/search
  - [ ] PUT /api/settings

### Phase 5: Infrastructure

- [ ] **5.1** AWS setup
  - [ ] Create VPC with subnets
  - [ ] Provision RDS PostgreSQL with pgvector
  - [ ] Provision EC2 for scraper
  - [ ] Set up Secrets Manager

- [ ] **5.2** Deployment
  - [ ] GitHub Actions workflow
  - [ ] Vercel project for frontend
  - [ ] EC2 systemd service for scraper
  - [ ] Cron job configuration

- [ ] **5.3** Monitoring
  - [ ] CloudWatch log groups
  - [ ] CloudWatch alarms
  - [ ] SNS topic for notifications
  - [ ] Basic dashboard

### Phase 6: Polish & Launch

- [ ] **6.1** Testing
  - [ ] Unit tests for scraper
  - [ ] Unit tests for workers
  - [ ] Integration tests for API routes
  - [ ] End-to-end test for full pipeline

- [ ] **6.2** Documentation
  - [ ] README with setup instructions
  - [ ] API documentation
  - [ ] Runbook for common issues

- [ ] **6.3** Launch
  - [ ] Run full pipeline manually
  - [ ] Verify data in production
  - [ ] Enable automated cron
  - [ ] Monitor first week of runs

---

## Appendix: Quick Reference

### Key Commands

```bash
# Local development
make db-up                    # Start local Postgres
make dev-web                  # Start Next.js dev server
make dev-scraper              # Run scraper in dry-run mode

# Deployment
git push origin main          # Triggers CI/CD

# Database
npx prisma migrate deploy     # Run migrations
npx prisma studio             # Open DB GUI

# Scraper (on EC2)
sudo systemctl status nextdoor-scraper
sudo journalctl -u nextdoor-scraper -f
```

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/nextdoor"

# Auth
NEXTAUTH_SECRET="random-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# APIs
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."

# AWS (for scraper)
AWS_REGION="us-east-1"
AWS_SECRET_NAME="nextdoor/credentials"
```
