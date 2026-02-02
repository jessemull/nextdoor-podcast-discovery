"""Configuration constants for the scraper."""

import os
import sys


def _get_env(name: str, required: bool = True) -> str | None:
    """Get an environment variable with optional validation."""
    value = os.environ.get(name)
    if required and not value:
        print(f"ERROR: Required environment variable {name} is not set", file=sys.stderr)
        sys.exit(1)
    return value


def _get_optional_env(name: str, default: str | None = None) -> str | None:
    """Get an optional environment variable with a default."""
    return os.environ.get(name, default)


# Scraper settings
SCRAPER_CONFIG = {
    "headless": True,  # GitHub Actions = headless only
    "scroll_delay_ms": (2000, 5000),  # Random delay range
    "max_posts_per_run": 100,
    "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
}


def validate_env() -> None:
    """Validate all required environment variables are set.
    
    Call this at the start of the pipeline to fail fast.
    """
    required_vars = [
        "SUPABASE_URL",
        "SUPABASE_KEY",
        "SESSION_ENCRYPTION_KEY",
        "ANTHROPIC_API_KEY",
        "OPENAI_API_KEY",
    ]
    
    missing = [var for var in required_vars if not os.environ.get(var)]
    
    if missing:
        print("ERROR: Missing required environment variables:", file=sys.stderr)
        for var in missing:
            print(f"  - {var}", file=sys.stderr)
        sys.exit(1)


# Environment variables - loaded lazily when accessed
def get_nextdoor_email() -> str:
    """Get Nextdoor email (required for login)."""
    return _get_env("NEXTDOOR_EMAIL") or ""


def get_nextdoor_password() -> str:
    """Get Nextdoor password (required for login)."""
    return _get_env("NEXTDOOR_PASSWORD") or ""


def get_supabase_url() -> str:
    """Get Supabase URL."""
    return _get_env("SUPABASE_URL") or ""


def get_supabase_key() -> str:
    """Get Supabase service key."""
    return _get_env("SUPABASE_KEY") or ""


def get_session_encryption_key() -> str:
    """Get session encryption key (Fernet)."""
    return _get_env("SESSION_ENCRYPTION_KEY") or ""


def get_anthropic_api_key() -> str:
    """Get Anthropic API key."""
    return _get_env("ANTHROPIC_API_KEY") or ""


def get_openai_api_key() -> str:
    """Get OpenAI API key."""
    return _get_env("OPENAI_API_KEY") or ""


# Claude settings
CLAUDE_MODEL = "claude-3-haiku-20240307"
CLAUDE_MAX_TOKENS = 500

# OpenAI settings
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
EMBEDDING_BATCH_SIZE = 100
