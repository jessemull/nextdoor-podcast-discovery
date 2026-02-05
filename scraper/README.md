# Nextdoor Scraper

Python-based scraper for collecting and analyzing Nextdoor posts.

## Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# For development
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

## Project Structure

```
scraper/
├── src/
│   ├── __init__.py
│   ├── main.py           # Entry point
│   ├── config.py         # Configuration
│   └── exceptions.py     # Custom exceptions
├── tests/
│   └── test_*.py
├── .env                 # Environment variables (local only)
├── pyproject.toml
├── requirements.txt
└── README.md
```
