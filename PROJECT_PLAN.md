# Podcast Post Discovery Platform — Project Plan

> Complete technical plan for the Nextdoor post discovery system.
> 
> **Cost Target**: ~$1–$5/month using free tiers and cost-optimized services.

---

## Table of Contents

1. [System Overview](#1-system-overview)
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
| **Automated Scraping** | Twice-daily collection from Recent + Trending feeds |
| **LLM Analysis** | Score posts on humor, absurdity, drama, relatability |
| **Semantic Search** | Find related posts by meaning, not just keywords |
| **Curation Dashboard** | Private web UI for browsing, filtering, and selecting posts |
| **Episode Tracking** | Mark posts as used, prevent duplicates |
| **Pittsburgh Sports Facts** | Random facts for Matt on each login (powered by Claude) |

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

---

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

### Dual-Feed Pipeline (GitHub Actions)

We run **two separate cron jobs** to capture different types of content:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW 1: RECENT FEED @ 6:00 AM UTC                                  │
│  ────────────────────────────────────────────────────────────────────── │
│  Feed: Recent (chronological)                                           │
│  Target: 250 posts                                                      │
│  Purpose: Catch fresh overnight content                                 │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW 2: TRENDING FEED @ 6:00 PM UTC                                │
│  ────────────────────────────────────────────────────────────────────── │
│  Feed: Trending (high-engagement)                                       │
│  Target: 250 posts                                                      │
│  Purpose: Catch viral/absurd/dramatic posts                             │
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

## 8. Component Specifications

### 8.1 Scraper (GitHub Actions)

**Location**: `/scraper/`

**Runs in**: GitHub Actions Ubuntu runner

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

# Combined example (backfill trending)
python -m src.main --feed-type trending --max-posts 500 --visible
```

**Configuration** (in `scraper/src/config.py`):

```python
SCRAPER_CONFIG = {
    "headless": True,                    # Default: headless (GitHub Actions)
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
│                           GITHUB                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Repository: nextdoor                                             │  │
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
│                         │       │  • Sports Facts API     │
└─────────────────────────┘       └─────────────────────────┘
```

### No AWS Required!

| Previously | Now |
|------------|-----|
| EC2 | GitHub Actions |
| RDS | Supabase |
| Secrets Manager | GitHub Secrets |
| CloudWatch | GitHub Actions logs |
| S3 | Not needed |

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

### GitHub Actions Notifications

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

### GitHub Actions Workflows

#### Scraper (Dual-Feed Strategy)

We use **two scheduled workflows** to scrape different feeds at different times:

```yaml
# .github/workflows/scrape-recent.yml
name: Scrape Recent Feed

on:
  schedule:
    - cron: '0 6 * * *'  # 6:00 AM UTC daily
  workflow_dispatch:
    inputs:
      max_posts:
        description: 'Maximum posts to scrape'
        default: '250'

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
      
      - name: Scrape Recent Feed
        env:
          NEXTDOOR_EMAIL: ${{ secrets.NEXTDOOR_EMAIL }}
          NEXTDOOR_PASSWORD: ${{ secrets.NEXTDOOR_PASSWORD }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          SESSION_ENCRYPTION_KEY: ${{ secrets.SESSION_ENCRYPTION_KEY }}
        run: |
          cd scraper
          python -m src.main --feed-type recent --max-posts ${{ inputs.max_posts || '250' }}
```

```yaml
# .github/workflows/scrape-trending.yml
name: Scrape Trending Feed

on:
  schedule:
    - cron: '0 18 * * *'  # 6:00 PM UTC daily
  workflow_dispatch:
    inputs:
      max_posts:
        description: 'Maximum posts to scrape'
        default: '250'

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
      
      - name: Scrape Trending Feed
        env:
          NEXTDOOR_EMAIL: ${{ secrets.NEXTDOOR_EMAIL }}
          NEXTDOOR_PASSWORD: ${{ secrets.NEXTDOOR_PASSWORD }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          SESSION_ENCRYPTION_KEY: ${{ secrets.SESSION_ENCRYPTION_KEY }}
        run: |
          cd scraper
          python -m src.main --feed-type trending --max-posts ${{ inputs.max_posts || '250' }}
```

**Manual Backfill**: Use `workflow_dispatch` to trigger manual runs with higher `max_posts` for initial data population.

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
| **Compute** | GitHub Actions | Free, Playwright support |
| **Database** | Supabase Free | PostgreSQL + pgvector, 500MB free |
| **LLM Model** | Claude Haiku | 20x cheaper than Sonnet |
| **Embeddings** | OpenAI | Cheap, proven quality |
| **Secrets** | GitHub Secrets | Free, integrated |
| **Frontend Host** | Vercel Free | Best Next.js support |
| **Auth** | NextAuth + Google | Simple, secure |
| **Sports Facts** | Claude Haiku on-demand | Fun feature, negligible cost |

### Trade-offs Accepted

| Trade-off | Impact | Mitigation |
|-----------|--------|------------|
| Monorepo | Larger clone | Still small project |
| GitHub Actions limit | 2,000 min/month | Only need ~150 |
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

- [ ] **2.2** Post Extraction (NEXT UP)
  - [ ] Add `--feed-type` CLI argument (recent/trending)
  - [ ] Navigate to correct feed tab
  - [ ] Scroll and load posts (infinite scroll handling)
  - [ ] Parse post DOM structure (text, author, timestamp, images)
  - [ ] SHA256 deduplication hash
  - [ ] Insert new posts to Supabase
  - [ ] Add `--max-posts` CLI argument (default 250)

- [x] **2.3** Reliability ✅ COMPLETE
  - [x] Retry logic (tenacity for transient failures)
  - [x] Custom exceptions (CaptchaRequiredError, LoginFailedError, etc.)
  - [x] Structured logging
  - [x] Dry-run mode (working)
  - [x] Context manager for browser cleanup

- [ ] **2.4** GitHub Actions
  - [ ] Create `scrape-recent.yml` (6:00 AM UTC)
  - [ ] Create `scrape-trending.yml` (6:00 PM UTC)
  - [ ] Test manual trigger (workflow_dispatch)
  - [ ] Verify data in Supabase

### Phase 3: LLM Integration

- [ ] **3.1** Claude Haiku scoring
  - [ ] Prompt template
  - [ ] JSON parsing
  - [ ] Batch processing

- [ ] **3.2** OpenAI embeddings
  - [ ] Embedding generation
  - [ ] Batch API calls
  - [ ] Store in pgvector

- [ ] **3.3** Ranking
  - [ ] Ranking formula
  - [ ] Weight configuration
  - [ ] Update rankings table

### Phase 4: Web UI

- [x] **4.1** Authentication
  - [x] NextAuth.js + Google OAuth
  - [x] Email whitelist
  - [x] Protected routes (middleware)

- [ ] **4.2** Core pages (scaffolds exist, need implementation)
  - [ ] Post feed with pagination
  - [ ] Post detail page
  - [x] Search page (placeholder)
  - [x] Settings page (placeholder)

- [x] **4.3** Components (core done)
  - [x] PostCard
  - [ ] RankingSliders
  - [ ] TagFilter
  - [ ] NeighborhoodFilter
  - [ ] SearchBar
  - [x] **SportsFact** (for special user)
  - [x] Navbar
  - [x] ErrorBoundary

- [ ] **4.4** API routes
  - [ ] GET /api/posts
  - [ ] GET /api/posts/:id
  - [ ] POST /api/posts/:id/use
  - [ ] GET /api/search
  - [ ] PUT /api/settings
  - [x] **GET /api/sports-fact**

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
| GitHub Actions | https://github.com/YOUR_USER/YOUR_REPO/actions |
| Anthropic | https://console.anthropic.com |
| OpenAI | https://platform.openai.com |

### Cost Monitoring

Check monthly:
- **Anthropic** → Usage → Haiku costs
- **OpenAI** → Usage → Embeddings costs
- **Supabase** → Usage → Storage
- **Vercel** → Usage → Bandwidth
