"""Playwright-based Nextdoor scraper."""

__all__ = ["NextdoorScraper"]

import logging
import os
import random
from typing import Any

from playwright.sync_api import (
    Browser,
    BrowserContext,
    Locator,
    Page,
    Playwright,
    TimeoutError as PlaywrightTimeoutError,
    sync_playwright,
)
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from src.config import LOGIN_URL, NEWS_FEED_URL, SCRAPER_CONFIG, SELECTORS
from src.exceptions import CaptchaRequiredError, LoginFailedError

logger = logging.getLogger(__name__)


class NextdoorScraper:
    """Scrapes posts from Nextdoor neighborhoods."""

    def __init__(self, headless: bool = True) -> None:
        """Initialize the scraper.

        Args:
            headless: Run browser in headless mode.
        """
        self._playwright: Playwright | None = None
        self.browser: Browser | None = None
        self.context: BrowserContext | None = None
        self.headless = headless
        self.page: Page | None = None

    def __enter__(self) -> "NextdoorScraper":
        """Context manager entry."""
        self.start()
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Context manager exit."""
        self.stop()

    def start(self) -> None:
        """Start the browser."""
        logger.info("Starting browser (headless=%s)", self.headless)
        self._playwright = sync_playwright().start()
        self.browser = self._playwright.chromium.launch(headless=self.headless)
        self.context = self.browser.new_context(
            user_agent=SCRAPER_CONFIG["user_agent"],
            viewport=SCRAPER_CONFIG["viewport"],
        )
        self.page = self.context.new_page()

    def stop(self) -> None:
        """Stop the browser and reset instance variables."""
        logger.info("Stopping browser")

        if self.context:
            self.context.close()
            self.context = None

        if self.browser:
            self.browser.close()
            self.browser = None

        if self._playwright:
            self._playwright.stop()
            self._playwright = None

        self.page = None

    @retry(
        retry=retry_if_exception_type(PlaywrightTimeoutError),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        before_sleep=lambda retry_state: logger.warning(
            "Login attempt %d failed, retrying...", retry_state.attempt_number
        ),
    )
    def login(self, email: str | None = None, password: str | None = None) -> None:
        """Log in to Nextdoor.

        Args:
            email: Nextdoor email (defaults to env var).
            password: Nextdoor password (defaults to env var).

        Raises:
            LoginFailedError: If login fails.
            CaptchaRequiredError: If CAPTCHA is detected.
        """
        if not self.page:
            raise RuntimeError("Browser not started. Call start() first.")

        email = email or os.environ.get("NEXTDOOR_EMAIL")
        password = password or os.environ.get("NEXTDOOR_PASSWORD")

        if not email or not password:
            raise LoginFailedError("NEXTDOOR_EMAIL and NEXTDOOR_PASSWORD required")

        timeout = SCRAPER_CONFIG["navigation_timeout_ms"]

        logger.info("Navigating to login page")
        self.page.goto(LOGIN_URL)

        # Wait for login form to load

        self.page.wait_for_selector(SELECTORS["email_input"], timeout=timeout)

        # Check for CAPTCHA

        if self._check_for_captcha():
            raise CaptchaRequiredError("CAPTCHA detected on login page")

        logger.info("Filling login form")

        # Fill email

        email_input = self.page.locator(SELECTORS["email_input"])
        email_input.click()
        self._human_type(email_input, email)

        # Random delay between fields

        self._random_delay()

        # Fill password

        password_input = self.page.locator(SELECTORS["password_input"])
        password_input.click()
        self._human_type(password_input, password)

        # Random delay before submit

        self._random_delay()

        # Click login button

        logger.info("Submitting login")
        self.page.locator(SELECTORS["login_button"]).click()

        # Wait for navigation

        login_timeout = SCRAPER_CONFIG["login_timeout_ms"]

        try:
            self.page.wait_for_url("**/news_feed/**", timeout=login_timeout)
            logger.info("Login successful")
        except PlaywrightTimeoutError as timeout_error:
            # Check if we hit a CAPTCHA (not retryable)

            if self._check_for_captcha():
                raise CaptchaRequiredError("CAPTCHA required after login attempt")

            # Check for error messages (not retryable - likely wrong credentials)

            error_text = self._get_login_error()
            if error_text:
                raise LoginFailedError(f"Login failed: {error_text}")

            # No CAPTCHA or error - could be transient, let tenacity retry

            raise timeout_error

    def load_cookies(self, cookies: list[dict[str, Any]]) -> None:
        """Load session cookies into browser context.

        Args:
            cookies: List of cookie dictionaries.
        """
        if not self.context:
            raise RuntimeError("Browser not started. Call start() first.")

        logger.info("Loading %d cookies", len(cookies))
        self.context.add_cookies(cookies)

    def get_cookies(self) -> list[dict[str, Any]]:
        """Get current session cookies.

        Returns:
            List of cookie dictionaries.
        """
        if not self.context:
            raise RuntimeError("Browser not started. Call start() first.")

        return self.context.cookies()

    def is_logged_in(self) -> bool:
        """Check if currently logged in to Nextdoor.

        Note: This navigates to the news feed page to verify login status.
        The page will change as a side effect.

        Returns:
            True if logged in, False otherwise.
        """
        if not self.page:
            return False

        timeout = SCRAPER_CONFIG["navigation_timeout_ms"]

        try:
            self.page.goto(NEWS_FEED_URL, timeout=timeout)

            # If we get redirected to login, we're not logged in

            return "/login" not in self.page.url
        except PlaywrightTimeoutError:
            return False

    def _check_for_captcha(self) -> bool:
        """Check if CAPTCHA is present on page.

        Returns:
            True if CAPTCHA detected.
        """
        if not self.page:
            return False

        for selector in SELECTORS["captcha_indicators"]:
            if self.page.locator(selector).count() > 0:
                return True

        return False

    def _get_login_error(self) -> str | None:
        """Get login error message if present.

        Returns:
            Error message or None.
        """
        if not self.page:
            return None

        for selector in SELECTORS["error_indicators"]:
            elements = self.page.locator(selector)
            if elements.count() > 0:
                return elements.first.text_content()

        return None

    def _human_type(self, locator: Locator, text: str) -> None:
        """Type text with human-like delays.

        Args:
            locator: Playwright locator.
            text: Text to type.
        """
        min_delay, max_delay = SCRAPER_CONFIG["typing_delay_ms"]

        for char in text:
            locator.type(char, delay=random.randint(min_delay, max_delay))

    def _random_delay(self) -> None:
        """Wait for a random delay to mimic human behavior."""
        if not self.page:
            return

        min_ms, max_ms = SCRAPER_CONFIG["scroll_delay_ms"]
        delay = random.randint(min_ms, max_ms)
        self.page.wait_for_timeout(delay)
