"""Custom exceptions for the scraper."""


class ScraperError(Exception):
    """Base exception for scraper errors."""
    ...


class SessionExpiredError(ScraperError):
    """Nextdoor session has expired, need fresh login."""
    ...


class RateLimitError(ScraperError):
    """Hit rate limit, need to back off."""
    ...


class CaptchaRequiredError(ScraperError):
    """CAPTCHA challenge detected."""
    ...


class LoginFailedError(ScraperError):
    """Failed to log in to Nextdoor."""
    ...


class ExtractionError(ScraperError):
    """Failed to extract post data from page."""
    ...
