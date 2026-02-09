"""Configuration constants for the scraper."""

import os
from typing import TypedDict

# Re-exported for convenience (defined in exceptions.py)
from src.exceptions import ConfigurationError

__all__ = [
    "CLAUDE_MAX_TOKENS",
    "CLAUDE_MODEL",
    "ConfigurationError",
    "EMBEDDING_BATCH_SIZE",
    "EMBEDDING_DIMENSIONS",
    "EMBEDDING_MODEL",
    "FEED_URLS",
    "LOGIN_URL",
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
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    ),
    "viewport": {"height": 812, "width": 375},
}

# URLs

LOGIN_URL = "https://nextdoor.com/login/"
NEWS_FEED_URL = "https://nextdoor.com/news_feed/"

# Feed URLs for different tabs

FEED_URLS = {
    "recent": "https://nextdoor.com/news_feed/?ordering=recent",
    "trending": "https://nextdoor.com/news_feed/?ordering=trending",
}

# Selectors (role-based for reliability)

SELECTORS: Selectors = {
    # CAPTCHA detection
    "captcha_indicators": [
        "iframe[src*='captcha']",
        "iframe[src*='recaptcha']",
        "[class*='captcha']",
        "[id*='captcha']",
    ],
    # Login page
    "email_input": 'role=textbox[name="Email or mobile number"]',
    "error_indicators": [
        "[class*='error']",
        "[class*='alert']",
        "[role='alert']",
    ],
    "feed_tab_recent": 'role=radio[name="Recent"]',
    "feed_tab_trending": 'role=radio[name="Trending"]',
    "login_button": 'role=button[name="Log in"]',
    "password_input": 'role=textbox[name="Password"]',
}


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
