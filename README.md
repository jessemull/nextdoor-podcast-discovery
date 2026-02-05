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
# Edit both files with your API keys

# Load scraper env vars into your shell (zsh/bash)
set -a
source scraper/.env
set +a

# Run the scraper (dry run)
make dev-scraper

# Start the web app
make dev-web
```

## Project Structure

```
nextdoor/
├── scraper/                # Python scraper + LLM workers
│   ├── src/
│   │   ├── __init__.py
│   │   ├── main.py         # Entry point
│   │   ├── config.py       # Configuration
│   │   └── exceptions.py   # Custom exceptions
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
