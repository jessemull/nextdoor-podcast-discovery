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

# Dry run (no database changes)
python -m src.main --dry-run

# Scrape specific feed type
python -m src.main --feed-type trending
python -m src.main --feed-type recent

# Full options
python -m src.main --feed-type recent --max-posts 250 --score
```

**Full pipeline (scrape + score + embeddings):** Run `python -m src.main --score` for scraping and scoring, then run `python -m src.embed` separately to generate embeddings. The embed script is standalone (no browser or Nextdoor access).

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

### Local Cron + Healthchecks.io

For local cron runs with monitoring, use the run scripts from the repo root:

```bash
# Scrape recent feed (scrape + score + recount topic frequencies)
./scripts/run-scrape.sh recent

# Scrape trending feed
./scripts/run-scrape.sh trending

# Generate embeddings
./scripts/run-embeddings.sh
```

Add to `scraper/.env`:

```
HEALTHCHECK_URL=https://hc-ping.com/your-scrape-uuid
HEALTHCHECK_EMBED_URL=https://hc-ping.com/your-embeddings-uuid
```

Create checks at [healthchecks.io](https://healthchecks.io) and set schedules to match your cron. On success the script pings the URL; on failure it pings `/fail` so you get alerts.

Example crontab:

```
0 8 * * * cd /path/to/nextdoor && ./scripts/run-scrape.sh recent
0 14 * * * cd /path/to/nextdoor && ./scripts/run-scrape.sh trending
0 22 * * * cd /path/to/nextdoor && ./scripts/run-embeddings.sh
```

## Testing

```bash
pytest
```

## Scraping policy

- **Rate limiting:** The scraper uses configurable delays (scroll, typing) to avoid hammering the site. See `SCRAPER_CONFIG` in `src/config.py` (`scroll_delay_ms`, `typing_delay_ms`, `navigation_timeout_ms`). The codebase defines `RateLimitError` in `src/exceptions.py` for future use: if the site returns HTTP 429 (Too Many Requests), you can catch it, raise or handle `RateLimitError`, and implement backoff/retry (e.g. with tenacity) before resuming.
### robots.txt (optional check)

The scraper does **not** check robots.txt by default. You can run with `--check-robots` to fetch the site's robots.txt and exit with an error if the paths we use (`/login/`, `/news_feed/`) are disallowed. Use this when you want to respect the site's crawler policy (e.g. when running against other domains). See `src/robots.py` and `LOGIN_URL`, `FEED_URLS` in `src/config.py` for the URLs used.
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
│   ├── novelty.py        # Novelty calculation (scorer + worker)
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
