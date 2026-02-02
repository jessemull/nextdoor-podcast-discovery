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

Copy the example file and fill in your values:

```bash
cp .env.example .env
# Edit .env with your values
```

Required variables (see `.env.example` for details):

- `NEXTDOOR_EMAIL` — Your Nextdoor account email
- `NEXTDOOR_PASSWORD` — Your Nextdoor account password
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_KEY` — Supabase service role key (not anon key)
- `SESSION_ENCRYPTION_KEY` — Fernet key for cookie encryption
- `ANTHROPIC_API_KEY` — Claude API key for scoring
- `OPENAI_API_KEY` — OpenAI API key for embeddings

## Usage

```bash
# Run the full pipeline
python -m src.main

# Dry run (no database changes)
python -m src.main --dry-run
```

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
├── .env.example          # Example environment variables
├── pyproject.toml
├── requirements.txt
└── README.md
```
