"""Configuration constants for the scraper."""

import os
import sys

# Claude settings

CLAUDE_MAX_TOKENS = 500
CLAUDE_MODEL = "claude-3-haiku-20240307"

# OpenAI settings

EMBEDDING_BATCH_SIZE = 100
EMBEDDING_DIMENSIONS = 1536
EMBEDDING_MODEL = "text-embedding-3-small"

# Required environment variables
# NOTE: Both scraper and web use SUPABASE_SERVICE_KEY for consistency

REQUIRED_ENV_VARS = [
    "ANTHROPIC_API_KEY",
    "NEXTDOOR_EMAIL",
    "NEXTDOOR_PASSWORD",
    "OPENAI_API_KEY",
    "SESSION_ENCRYPTION_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_URL",
]

# Scraper settings

SCRAPER_CONFIG = {
    "headless": True,
    "max_posts_per_run": 100,
    "scroll_delay_ms": (2000, 5000),
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
}


def validate_env() -> None:
    """Validate all required environment variables are set.

    Call this at the start of the pipeline to fail fast.
    """
    missing = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]

    if missing:
        print("ERROR: Missing required environment variables:", file=sys.stderr)
        for var in missing:
            print(f"  - {var}", file=sys.stderr)
        sys.exit(1)
