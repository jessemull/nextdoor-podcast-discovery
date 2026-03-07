"""Configuration constants for the scraper."""

import logging
import os
from typing import TypedDict

# Re-exported for convenience (defined in exceptions.py)
from src.exceptions import ConfigurationError

__all__ = [
    "CLAUDE_MAX_TOKENS",
    "CLAUDE_MODEL",
    "ConfigurationError",
    "EMBEDDING_BATCH_SIZE",
    "EMBEDDING_CHUNK_SIZE",
    "EMBEDDING_DIMENSIONS",
    "EMBEDDING_MODEL",
    "ENSEMBLE_RUNS",
    "ENSEMBLE_TEMPERATURE",
    "FEED_URLS",
    "LOGIN_URL",
    "log_supabase_error",
    "NEWS_FEED_URL",
    "REQUIRED_ENV_VARS",
    "SCRAPER_CONFIG",
    "SELECTORS",
    "Selectors",
    "ViewportSize",
    "validate_env",
]

# Claude settings

CLAUDE_MAX_TOKENS = 500
CLAUDE_MODEL = "claude-3-haiku-20240307"
ENSEMBLE_RUNS = 3
ENSEMBLE_TEMPERATURE = 0.3

# OpenAI settings

EMBEDDING_BATCH_SIZE = 100
EMBEDDING_CHUNK_SIZE = 500
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


# Type definitions for config


class ViewportSize(TypedDict):
    """Browser viewport dimensions."""

    height: int
    width: int


class ScraperConfig(TypedDict):
    """Typed configuration for the scraper."""

    headless: bool
    login_timeout_ms: int
    max_posts_per_run: int
    max_scroll_attempts_trending: int
    modal_close_delay_ms: int
    modal_timeout_ms: int
    navigation_timeout_ms: int
    repeat_threshold_recent: int
    scroll_delay_ms: tuple[int, int]
    typing_delay_ms: tuple[int, int]
    user_agent: str
    viewport: ViewportSize


class Selectors(TypedDict):
    """Typed selectors for Playwright."""

    captcha_indicators: list[str]
    email_input: str
    error_indicators: list[str]
    feed_tab_recent: str
    feed_tab_trending: str
    login_button: str
    password_input: str


# Scraper settings
#
# Mobile Chrome: use mobile viewport and user agent for inspect / comment flow
# experimentation. Desktop was used for modal comment extraction but caused feed
# scroll reset; mobile may offer a different pattern for comments.

SCRAPER_CONFIG: ScraperConfig = {
    "headless": True,
    "login_timeout_ms": 15000,
    "max_posts_per_run": 250,
    "max_scroll_attempts_trending": 50,
    "modal_close_delay_ms": 300,
    "modal_timeout_ms": 5000,
    "navigation_timeout_ms": 10000,
    "repeat_threshold_recent": 10,
    "scroll_delay_ms": (2000, 5000),
    "typing_delay_ms": (50, 150),
    "user_agent": (
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Mobile Safari/537.36"
    ),
    "viewport": {"height": 844, "width": 390},
}

# URLs

LOGIN_URL = "https://nextdoor.com/login/"
NEWS_FEED_URL = "https://nextdoor.com/news_feed/"

# Feed URLs for different tabs

FEED_URLS = {
    "recent": "https://nextdoor.com/news_feed/?ordering=recent",
    "trending": "https://nextdoor.com/news_feed/?ordering=trending",
}

# Selectors (desktop: SIGNIN.html, TRENDING.html)
# Login: desktop uses data-testid and id; role=textbox works for inputs with aria-label.

SELECTORS: Selectors = {
    # CAPTCHA detection
    "captcha_indicators": [
        "iframe[src*='captcha']",
        "iframe[src*='recaptcha']",
        "[class*='captcha']",
        "[id*='captcha']",
    ],
    # Login page (desktop SIGNIN.html: id_email, id_password, data-testid=signin_button)
    "email_input": '[data-testid="email-address-input"], #id_email',
    "error_indicators": [
        "[class*='error']",
        "[class*='alert']",
        "[role='alert']",
    ],
    # Feed tabs (desktop TRENDING.html: simple tab buttons)
    "feed_tab_recent": 'role=tab[name="Most Recent"]',
    "feed_tab_trending": 'role=tab[name="Trending"]',
    "login_button": '[data-testid="signin_button"], #signin_button',
    "password_input": '[data-testid="password-input"], #id_password',
}


def log_supabase_error(context: str, e: Exception) -> None:
    """Log a Supabase/DB error with context.

    Use in broad except blocks where Supabase does not export specific
    exception types, so logging is consistent and actionable.
    """
    _logger = logging.getLogger(__name__)
    _logger.error("%s: %s (%s)", context, e, type(e).__name__)


def validate_env() -> None:
    """Validate all required environment variables are set.

    Call this at the start of the pipeline to fail fast.

    Raises:
        ConfigurationError: If any required env vars are missing.
    """
    missing = [var for var in REQUIRED_ENV_VARS if not os.environ.get(var)]

    if missing:
        raise ConfigurationError(
            f"Missing required environment variables: {', '.join(missing)}"
        )
