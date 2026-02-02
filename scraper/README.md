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

Create a `.env` file (see `.env.example` in project root):

```bash
NEXTDOOR_EMAIL=your-email@example.com
NEXTDOOR_PASSWORD=your-password
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJ...
SESSION_ENCRYPTION_KEY=your-fernet-key
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

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
│   ├── main.py              # Entry point
│   ├── config.py            # Configuration
│   ├── exceptions.py        # Custom exceptions
│   ├── scraper.py           # Browser automation
│   ├── session_manager.py   # Cookie management
│   ├── post_extractor.py    # DOM parsing
│   ├── llm_scorer.py        # Claude scoring
│   ├── embedder.py          # OpenAI embeddings
│   └── ranker.py            # Score calculation
├── tests/
│   └── test_*.py
├── pyproject.toml
├── requirements.txt
└── README.md
```
