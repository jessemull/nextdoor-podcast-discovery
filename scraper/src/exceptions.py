"""Custom exceptions for the scraper."""


class ScraperError(Exception):
    """Base exception for scraper errors."""

    pass


class SessionExpiredError(ScraperError):
    """Nextdoor session has expired, need fresh login."""

    pass


class RateLimitError(ScraperError):
    """Hit rate limit, need to back off."""

    pass


class CaptchaRequiredError(ScraperError):
    """CAPTCHA challenge detected."""

    pass


class LoginFailedError(ScraperError):
    """Failed to log in to Nextdoor."""

    pass


class ExtractionError(ScraperError):
    """Failed to extract post data from page."""

    pass
