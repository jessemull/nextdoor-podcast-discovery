"""Configuration constants for the scraper."""

import os
import sys


# Scraper settings
SCRAPER_CONFIG = {
    "headless": True,  # GitHub Actions = headless only
    "scroll_delay_ms": (2000, 5000),  # Random delay range
    "max_posts_per_run": 100,
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
}

# Required environment variables
REQUIRED_ENV_VARS = [
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "SESSION_ENCRYPTION_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "NEXTDOOR_EMAIL",
    "NEXTDOOR_PASSWORD",
]


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


# Claude settings
CLAUDE_MODEL = "claude-3-haiku-20240307"
CLAUDE_MAX_TOKENS = 500

# OpenAI settings
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
EMBEDDING_BATCH_SIZE = 100
