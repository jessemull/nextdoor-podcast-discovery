# Nextdoor Podcast Discovery Platform

Automatically discover, analyze, and curate interesting Nextdoor posts for podcast content.

## Features

- 🔍 **Automated Scraping** — Daily collection of posts from configured neighborhoods
- 🤖 **LLM Analysis** — Score posts on humor, absurdity, drama, relatability using Claude Haiku
- 🔎 **Semantic Search** — Find related posts by meaning using OpenAI embeddings
- 📊 **Curation Dashboard** — Private web UI for browsing, filtering, and selecting posts
- 📝 **Episode Tracking** — Mark posts as used, prevent duplicates
- 🏈 **Pittsburgh Sports Facts** — Random facts for Matt on each login!

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GitHub Actions │────▶│    Supabase     │◀────│     Vercel      │
│  (Daily Scrape) │     │  (PostgreSQL)   │     │   (Next.js)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐                           ┌─────────────────┐
│  Claude Haiku   │                           │   Web Dashboard │
│  (Scoring)      │                           │   (Private)     │
└─────────────────┘                           └─────────────────┘
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

# Install dependencies
make install

# Start local database
make db-up

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Run the scraper (dry run)
make dev-scraper

# Start the web app
make dev-web
```

## Project Structure

```
nextdoor/
├── scraper/          # Python scraper + LLM workers
├── web/              # Next.js frontend
├── database/         # SQL migrations
├── scripts/          # Utility scripts
├── .github/          # CI/CD workflows
├── docker-compose.yml
├── Makefile
└── PROJECT_PLAN.md   # Full architecture documentation
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
| GitHub Actions | Free (2000 min/mo) |
| Claude Haiku | ~$1/mo |
| OpenAI Embeddings | ~$0.50/mo |
| **Total** | **~$1.50/mo** |

## License

MIT
