# Nextdoor Podcast Discovery Platform

Automatically discover, analyze, and curate interesting Nextdoor posts for podcast content.

## Features

- 🔍 **Automated Scraping** — Twice-daily collection from Recent and Trending feeds
- 🤖 **LLM Analysis** — Score posts on humor, absurdity, drama, relatability using Claude Haiku
- 🔎 **Semantic Search** — Find related posts by meaning using OpenAI embeddings
- 📊 **Curation Dashboard** — Private web UI for browsing, filtering, and selecting posts
- 📝 **Episode Tracking** — Mark posts as used, prevent duplicates
- 🏈 **Pittsburgh Sports Facts** — Random facts for Matt on each login!

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Local Linux    │────▶│    Supabase     │◀────│     Vercel      │
│  (Cron Jobs)    │     │  (PostgreSQL)   │     │   (Next.js)     │
│  - Scrape       │     │  + pgvector     │     │   (Web UI)      │
│  - Score        │     │                  │     │                 │
│  - Embed        │     │                  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐   ┌─────────────────┐
│  Claude Haiku   │   │  OpenAI         │
│  (Scoring)      │   │  (Embeddings)   │
└─────────────────┘   └─────────────────┘
```

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for local database)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd nextdoor

# Create virtual environment
make venv
source .venv/bin/activate

# Install dependencies
make install

# Start local database
make db-up

# Create environment variable files
touch scraper/.env
touch web/.env.local
# Edit both files with your API keys (see Environment variables below)

# Load scraper env vars into your shell (zsh/bash)
set -a
source scraper/.env
set +a

# Run the scraper (dry run)
make dev-scraper

# Start the web app
make dev-web
```

## Environment variables

Required environment variables are defined in each app’s example file:

- **Scraper:** [scraper/.env.example](./scraper/.env.example) — Nextdoor credentials, Supabase, session encryption, Anthropic, OpenAI.
- **Web:** [web/.env.example](./web/.env.example) — Supabase, NextAuth, Google OAuth, allowed emails.

Copy to `.env` (scraper) or `.env.local` (web) and fill in your values.

## Project Structure

```
nextdoor/
├── scraper/                # Python scraper + LLM workers
│   ├── src/
│   │   ├── __init__.py
│   │   ├── config.py       # Configuration
│   │   ├── embed.py        # Standalone embedding script
│   │   ├── embedder.py     # OpenAI embeddings
│   │   ├── exceptions.py   # Custom exceptions
│   │   ├── llm_scorer.py   # Claude scoring
│   │   ├── main.py         # Entry point
│   │   ├── novelty.py      # Shared novelty calculation (scorer + worker)
│   │   ├── post_extractor.py
│   │   ├── post_storage.py
│   │   ├── scraper.py      # Playwright scraper
│   │   ├── session_manager.py
│   │   └── worker.py       # Background job worker
│   ├── tests/
│   ├── requirements.txt
│   └── pyproject.toml
├── web/                    # Next.js frontend
│   ├── app/                # Next.js App Router pages
│   ├── components/         # React components
│   ├── lib/                # Utilities and config
│   └── package.json
├── database/               # SQL migrations
│   └── migrations/
├── scripts/                # Utility scripts
├── .github/                # CI/CD workflows
├── docker-compose.yml
├── Makefile
└── PROJECT_PLAN.md         # Full architecture documentation
```

## Scraping policy

The scraper uses configurable delays and does not currently fetch or enforce Nextdoor’s **robots.txt**. If you run this against other domains, consider adding a startup check to fetch and respect robots.txt. See [scraper/README.md](./scraper/README.md) for rate limiting and policy details.

## Documentation

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for complete architecture documentation including:

- Detailed architecture diagrams
- Database schema
- API specifications
- Deployment guide
- Implementation checklist

## Cost

This project is designed to run on free tiers + minimal API costs:

| Service | Cost |
|---------|------|
| Supabase | Free (500MB) |
| Vercel | Free (Hobby) |
| Local Linux | Free (your hardware) |
| Claude Haiku | ~$1/mo |
| OpenAI Embeddings | ~$0.50/mo |
| **Total** | **~$1.50/mo** |

## License

MIT
