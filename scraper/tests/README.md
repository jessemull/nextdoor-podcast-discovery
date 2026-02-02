# Scraper Tests

This directory contains tests for the Nextdoor scraper.

## Running Tests

```bash
# From the scraper directory
pytest

# With coverage
pytest --cov=src
```

## Tests to Implement

### Priority 1: Core Functionality
- [ ] `test_config.py` - Test `validate_env()` with missing/present env vars
- [ ] `test_exceptions.py` - Test exception hierarchy and messages

### Priority 2: Scraping (requires mocking)
- [ ] `test_scraper.py` - Test post extraction with mocked HTML
- [ ] `test_session_manager.py` - Test cookie encryption/decryption

### Priority 3: LLM Integration (requires mocking)
- [ ] `test_llm_scorer.py` - Test scoring with mocked Claude responses
- [ ] `test_embedder.py` - Test embedding generation with mocked OpenAI

### Priority 4: Database
- [ ] `test_database.py` - Test Supabase operations with test database

## Mocking Strategy

Use `pytest-mock` and `responses` for mocking external APIs:
- Mock Playwright for scraping tests
- Mock Anthropic client for LLM tests
- Mock OpenAI client for embedding tests
- Use a test Supabase project or mock for DB tests
