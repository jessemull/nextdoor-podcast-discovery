# Nextdoor Scraper

Python-based scraper for collecting and analyzing Nextdoor posts.

## Setup

The root Makefile uses a virtual environment at `.venv`. From the repo root:

```bash
make venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
make install-scraper
```

Or from the `scraper/` directory:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

pip install -r requirements.txt
playwright install chromium

# For development (lint, test, type-check)
pip install -r requirements-dev.txt
```

## Environment Variables

Create a `.env` file and fill in your values:

```bash
touch .env
# Edit .env with your values

# Load variables into your shell (zsh/bash)
set -a
source .env
set +a
```

Required variables:

- `NEXTDOOR_EMAIL` — Your Nextdoor account email
- `NEXTDOOR_PASSWORD` — Your Nextdoor account password
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key (not anon key)
- `SESSION_ENCRYPTION_KEY` — Fernet key for cookie encryption
- `ANTHROPIC_API_KEY` — Claude API key for scoring
- `OPENAI_API_KEY` — OpenAI API key for embeddings

## Usage

### Scraping

```bash
# Run the full pipeline (scrape only)
python -m src.main

# Scrape with LLM scoring
python -m src.main --score

# Combine: scrape, score, and generate embeddings
python -m src.main --score --embed

# Dry run (no database changes)
python -m src.main --dry-run

# Scrape specific feed type
python -m src.main --feed-type trending
python -m src.main --feed-type recent

# Full options
python -m src.main --feed-type recent --max-posts 250 --score --embed
```

### Embeddings (Standalone)

```bash
# Generate embeddings for posts without them
# Use this for the daily embedding cron job
python -m src.embed

# Dry run (no database changes)
python -m src.embed --dry-run
```

**Note**: The `embed.py` script:
- Only generates embeddings (no browser, no login, no Nextdoor access)
- Processes all posts in the database that don't have embeddings
- Skips posts that already have embeddings (safe to run multiple times)
- Processes posts in batches efficiently

## Testing

```bash
pytest
```

## Scraping policy

- **Rate limiting:** The scraper uses configurable delays (scroll, typing) to avoid hammering the site. See `SCRAPER_CONFIG` in `src/config.py` (`scroll_delay_ms`, `typing_delay_ms`, `navigation_timeout_ms`).
- **robots.txt:** We do not currently fetch or enforce Nextdoor’s robots.txt. If you run this against other domains, consider adding a startup check and respecting disallow rules.

## Project Structure

```
scraper/
├── src/
│   ├── __init__.py
│   ├── config.py         # Configuration
│   ├── embed.py          # Standalone embedding script
│   ├── embedder.py       # OpenAI embeddings
│   ├── exceptions.py     # Custom exceptions
│   ├── llm_scorer.py     # Claude scoring
│   ├── main.py           # Entry point
│   ├── post_extractor.py # Feed parsing
│   ├── post_storage.py   # Supabase storage
│   ├── scraper.py        # Playwright browser scraper
│   ├── session_manager.py
│   └── worker.py         # Background job worker
├── tests/
│   └── test_*.py
├── .env                  # Environment variables (local only)
├── pyproject.toml
├── requirements.txt
└── README.md
```
