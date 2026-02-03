"""Custom exceptions for the scraper."""

__all__ = [
    "CaptchaRequiredError",
    "ConfigurationError",
    "ExtractionError",
    "LoginFailedError",
    "RateLimitError",
    "ScraperError",
    "SessionExpiredError",
]


class ScraperError(Exception):
    """Base exception for scraper errors."""

    ...


class ConfigurationError(ScraperError):
    """Raised when required configuration is missing."""

    ...


class SessionExpiredError(ScraperError):
    """Nextdoor session has expired, need fresh login.

    Note: Placeholder for future use in session validation.
    """

    ...


class RateLimitError(ScraperError):
    """Hit rate limit, need to back off.

    Note: Placeholder for future use in rate limit handling.
    """

    ...


class CaptchaRequiredError(ScraperError):
    """CAPTCHA challenge detected."""

    ...


class LoginFailedError(ScraperError):
    """Failed to log in to Nextdoor."""

    ...


class ExtractionError(ScraperError):
    """Failed to extract post data from page.

    Note: Placeholder for future use in post extraction.
    """

    ...
